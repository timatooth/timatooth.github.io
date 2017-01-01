---
layout: post
title:  "Motion Sensing with Raspberry Pi Camera and Cat Face Scanning with AWS Lambda + OpenCV"
date:   2017-01-01 12:55:24 +1300
category: development
comments: true
tags: raspberrypi development python opencv cats
---
I wrote a Python script which uses OpenCV for detecting motion with the official
Raspberry Pi Camera Module for uploading frames to S3. The frames are then scanned
by a triggered Lambda function which uses Haar-Cascade object detection to search
for cat faces.

*This could also be done using Amazon's very cool new image 'Rekognition' service but would cost more if you are processing thousands of frames per day.*

<video loop autoplay class="post video-post" id="video-element" poster="//i.imgur.com/lTDfIbuh.jpg" preload="auto" muted="muted" webkit-playsinline="" style="width: 256px; height: 192px;"><source type="video/mp4" src="//i.imgur.com/lTDfIbu.mp4"></video>

I wanted to know how often my flatmate's cat was attempting to attack his mouse
enclosure. Cat detection events are sent to DataDog using statsd for alerting!

### Raspberry Pi Agent Code

I am monitoring the occurence of motion events using DataDog and uploading the frames
to S3 for further detection of objects in the frame such as cats or people.

Full source code is on GitHub: [timatooth/catscanface](https://github.com/timatooth/catscanface)

```python
import logging
logging.basicConfig(format='%(asctime)s %(name)s %(levelname)s %(message)s', level=logging.INFO)
log = logging.getLogger('catscanface-agent')
import datetime
import argparse
import time
import os

from picamera.array import PiRGBArray
from picamera import PiCamera
import cv2
import boto3


def annotate_frame(frame, contour):
    timestamp = datetime.datetime.now()
    ts = timestamp.strftime("%A %d %B %Y %I:%M:%S%p")
    (x, y, w, h) = cv2.boundingRect(contour)
    cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 255, 255), 2)
    cv2.putText(frame, ts, (10, frame.shape[0] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 255), 1)
    return frame


def start(args):
    camera = PiCamera()
    camera.resolution = args.resolution
    camera.framerate = args.fps
    hat = None
    statsd = None
    log.info("Warming up camera")
    time.sleep(5)

    if args.enable_sensehat:
        from sense_hat import SenseHat
        hat = SenseHat()
        hat.clear()

    if args.enable_statsd:
        from datadog import statsd

    loop(args, camera, hat, statsd)


def loop(args, camera, hat, statsd):
    avg = None
    raw_capture = PiRGBArray(camera, size=args.resolution)
    log.info("Starting capture")
    s3 = None
    if args.enable_s3:
        s3 = boto3.client('s3')

    for f in camera.capture_continuous(raw_capture, format="bgr", use_video_port=True):
        frame = f.array

        # resize, grayscale & blur out noise
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        # if the average frame is None, initialize it
        if avg is None:
            log.info("Initialising average frame")
            avg = gray.copy().astype("float")
            raw_capture.truncate(0)
            continue

        # accumulate the weighted average between the current frame and
        # previous frames, then compute the difference between the current
        # frame and running average
        cv2.accumulateWeighted(gray, avg, 0.5)
        frame_delta = cv2.absdiff(gray, cv2.convertScaleAbs(avg))

        # threshold the delta image, dilate the thresholded image to fill
        # in holes, then find contours on thresholded image
        thresh = cv2.threshold(frame_delta, args.delta_threshold, 255, cv2.THRESH_BINARY)[1]
        thresh = cv2.dilate(thresh, None, iterations=2)
        (contours, _) = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        motion = False
        for c in contours:
            # if the contour is too small, ignore it
            if cv2.contourArea(c) < args.min_area:
                continue

            motion = True
            log.info("Motion detected")

            # draw the text and timestamp on the frame
            if args.enable_annotate:
                frame = annotate_frame(frame, c)

            if args.enable_sensehat:
                hat.show_letter('X', back_colour=[255, 20, 50])

            if args.enable_statsd:
                statsd.increment('camera.motion_detected')

        if motion:
            img_name = datetime.datetime.utcnow().strftime('%Y-%m-%d_%H_%M_%S.%f') + '.jpg'
            img_path = '{}/{}'.format(args.image_path, img_name)
            cv2.imwrite(img_path, frame)

            # todo enqueue upload so it doesn't block main loop
            if args.enable_s3:
                with open(img_path, 'rb') as data:
                    log.debug('Uploading to s3://{}/{}{}...'.format(args.s3_bucket, args.s3_prefix, img_name))
                    s3.upload_fileobj(data, args.s3_bucket, args.s3_prefix + img_name)
                    log.debug('Uploaded')

        raw_capture.truncate(0)
        motion = False
        if args.enable_sensehat:
            hat.clear()


def str2bool(v):
    return v.lower() in ("yes", "true", "t", "1")


def parse_res(v):
    x, y = v.lower().split('x')
    return int(x), int(y)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Motion detect and upload frames to S3')
    parser.add_argument('--resolution', help='e.g 640x480', default=parse_res(os.environ.get('resolution', '640x480')))
    parser.add_argument('--fps', help='Framerate e.g: 18', default=int(os.environ.get('fps', '18')))
    parser.add_argument('--delta-threshold', default=int(os.environ.get('delta_threshold', 5)))
    parser.add_argument('--min-area', default=int(os.environ.get('min_area', 5000)))
    parser.add_argument('--enable-sensehat', help='Use Sense Hat display', action='store_true', default=str2bool(os.environ.get('enable_sensehat', '0')))
    parser.add_argument('--enable-statsd', help='Send metrics', action='store_true', default=str2bool(os.environ.get('enable_statsd', '0')))
    parser.add_argument('--enable-annotate', help='Draw detected regions to image', action='store_true', default=str2bool(os.environ.get('enable_annotate', '0')))
    parser.add_argument('--image-path', help='Where to save images locally eg /tmp', default=os.environ.get('image_path', '/tmp'))
    parser.add_argument('--enable-s3', help='Enable saving frames to AWS S3', action='store_true', default=os.environ.get('enable_s3', '1'))
    parser.add_argument('--s3-bucket', help='AWS S3 bucket to save frames', default=os.environ.get('s3_bucket', 'timatooth'))
    parser.add_argument('--s3-prefix', help='AWS S3 bucket prefix path e.g cats/', default=os.environ.get('s3_prefix', 'catscanface/motion/'))

    args = parser.parse_args()
    log.debug(args)
    start(args)
```

### Haar-Cascade Cat Detection with AWS Lambda

You will need to package compiled Numpy & OpenCV libraries prepared for running inside
the AWS Lambda functions thanks to *aeddi* https://github.com/aeddi/aws-lambda-python-opencv

```python
from __future__ import print_function
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)
import os
import os.path
import numpy
import cv2
import boto3

# Config
s3_prefix = 'catscanface/'
s3_bucket = 'timatooth'

cat_cascade = cv2.CascadeClassifier('haarcascade_frontalcatface_extended.xml')
s3_client = boto3.client('s3')

def scan_frame(image_data):
    img_array = numpy.asarray(bytearray(image_data), dtype=numpy.uint8)
    frame = cv2.imdecode(img_array, 0)
    cat_faces = cat_cascade.detectMultiScale(frame, 1.3, 5)
    # Draw rectangle onto region where cat face is found
    cat_detected = False
    for (x, y, w, h) in cat_faces:
        cat_detected = True
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
        logger.info("Found cat")

    if cat_detected:
        _, buf = cv2.imencode(".jpg", frame)
        return buf.tobytes()


def get_image(object_key):
    response = s3_client.get_object(Bucket=s3_bucket, Key=object_key)
    image_bytes = response['Body'].read()
    logger.info('Got {} bytes'.format(len(image_bytes)))
    return image_bytes


def lambda_handler(event, context):
    object_key = event['Records'][0]['s3']['object']['key']
    image_bytes = get_image(object_key)
    cat_image = scan_frame(image_bytes)
    if cat_image is not None:
        key = s3_prefix + 'detections/' + os.path.basename(object_key)
        logger.info('Saving cat detection image: {}'.format(key))
        s3_client.put_object(
            Bucket=s3_bucket,
            Key=key,
            Body=cat_image
        )
```

### CloudFormation


```yaml
---
AWSTemplateFormatVersion: '2010-09-09'
Description: Cat facial recognition OpenCV lambda
Parameters:
  S3BucketName:
    Type: String
    Description: The S3 bucket which contains cat pictures
  S3BucketPrefix:
    Type: String
    Description: A bucket prefix where the cat pictures are found
    Default: /catscanface
Resources:
  LambdaRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
        - Effect: Allow
          Principal:
            Service:
            - lambda.amazonaws.com
          Action:
          - sts:AssumeRole
      Path: "/"
      Policies:
      - PolicyName: CloudwatchLog
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
          - Effect: Allow
            Action:
            - logs:CreateLogGroup
            - logs:CreateLogStream
            - logs:PutLogEvents
            Resource: arn:aws:logs:*:*:*
      - PolicyName: AccessCatPictureBucket
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
          - Effect: Allow
            Action:
            - s3:GetObject
            Resource: !Join ['', ['arn:aws:s3:::', Ref: S3BucketName, Ref: S3BucketPrefix, '/motion/*']]
      - PolicyName: WriteDetectedCatFrames
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
          - Effect: Allow
            Action:
            - s3:PutObject
            Resource: !Join ['', ['arn:aws:s3:::', Ref: S3BucketName, Ref: S3BucketPrefix, '/detections/*']]
  Lambda:
    Type: AWS::Lambda::Function
    Properties:
      Code:
        ZipFile: 'print("hello world")'
      Description: Scan images uploaded to S3 for cats
      FunctionName:
        Ref: AWS::StackName
      Handler: catscan.lambda_handler
      MemorySize: 256
      Role: !GetAtt LambdaRole.Arn
      Runtime: python2.7
      Timeout: '4'
Outputs:
  LambdaRole:
    Description: IAM Role for LambdaRole
    Value:
      Ref: LambdaRole
  Lambda:
    Value: !GetAtt Lambda.Arn
```

