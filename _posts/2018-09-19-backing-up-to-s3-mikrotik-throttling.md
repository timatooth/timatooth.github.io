---
layout: post
title:  "Traffic Shaping Large Uploads to S3 with MikroTik RouterOS"
date:   2018-09-19 17:47:00 +1200
category: development
comments: true
tags: mikrotik routeros aws s3
---
# Traffic Shaping Large Uploads to S3 with MikroTik RouterOS

I currently have a very large collection of Canon Raw DSLR images I want to have a backup
in the cloud in case the unthinkable happens to my external drives. There are plenty of services targeted for photographers charged at
a premium. I want to do it the cheap way by uploading directly Amazon S3 to have them placed
in Glacier storage class.

There is one problem: I have 100Mbps down / 20Mbps up Internet speed and having this going
for a few days will destroy the network performance for everyone else.

I thought I'd try write some QoS Queue Tree rules that lets the upload use any bandwidth that's available but give it the lowest
possible priority so it does not impact other applications *cough* games.

Here is a crafty cURL + jq command to get the current IP ranges from AWS. These could always change as Amazon purchases more of the Internet :D

```bash
curl -s https://ip-ranges.amazonaws.com/ip-ranges.json | jq '.prefixes[] | select(.region == "ap-southeast-2" and .service == "S3").ip_prefix'
```

A quick `tcpdump` test confirms the bulk of the traffic goes to Sydney AWS S3 IP ranges over TLS when running `aws s3 cp`.

```bash
tcpdump -ni any "tcp port 443 and (net 54.231.248.0/22 or net 54.231.252.0/24 or net 52.92.52.0/22 or net 52.95.128.0/21)"

...
17:57:08.504279 IP 192.168.80.252.54392 > 52.95.132.33.443: Flags [S], seq 4232311673, win 29200, options [mss 1460,sackOK,TS val 770488105 ecr 0,nop,wscale 7], length 0
17:57:08.545803 IP 52.95.132.33.443 > 192.168.80.252.54392: Flags [S.], seq 3514300483, ack 4232311674, win 29200, options [mss 1432,wscale 8,nop,sackOK,nop,nop], length 0
...
```

Let's use this to create an Address-List in the router:

    /ip firewall address-list
    add list=aws-s3-apse2 comment="AWS S3 Sydney" address="54.231.248.0/22"
    add list=aws-s3-apse2 comment="AWS S3 Sydney" address="54.231.252.0/24"
    add list=aws-s3-apse2 comment="AWS S3 Sydney" address="52.92.52.0/22"
    add list=aws-s3-apse2 comment="AWS S3 Sydney" address="52.95.128.0/21"

Now create a mangle rule that watches for new connections to S3 and marks any packets packets which are part of the connection.

    /ip firewall mangle
    add chain=forward action=mark-connection new-connection-mark=aws-s3-sydney proto=tcp dst-port=443 dst-address-list=aws-s3-apse2
    add chain=forward action=mark-packet connection-mark=aws-s3-sydney new-packet-mark=AWS-S3-Upload

### Setting up the Queues

In my setup `ether5` is the WAN interface. This would normally be `ether1` or something like `vlan10` depending on your configuration.

    /queue tree
    add limit-at=20M max-limit=20M name=upload parent=ether5 \
      priority=6 queue=pcq-upload-default comment="base parent upload"

    add limit-at=20M max-limit=20M name=upload_pri_2 \
      packet-mark=no-mark parent=upload priority=2 \
      queue=pcq-upload-default comment="Regular unmarked upload traffic"

    add limit-at=10M max-limit=10M name=s3_low_pri_8 \
     packet-mark=AWS-S3-Upload parent=upload priority=8 \
     queue=pcq-upload-default comment="Govern bulk AWS S3 upload traffic"

### Testing it works

I created a 1GB random test file and used the aws CLI to copy it up to S3.

```bash
dd bs=1M count=1000 if=/dev/urandom of=1GB.test
aws s3 cp 1GB.test s3://my-bucket/
```

**It's NOT working!**

The first time I tried this I forgot to disable the FastTrack feature: https://wiki.mikrotik.com/wiki/Manual:IP/Fasttrack
This prevents the packets from entering the MikroTik's CPU for being inspected and queued which is what we want.

Disabling the fasttrack rule included with my RB750Gr3 default configuration fixes this.


I can now schedule `aws s3 sync /photos s3://my-bucket`
and not worry about impacting other Internet users.


**... or you could use the S3 max_bandwidth option**

Obviously this is the simpler option but I wanted to learn traffic shaping on RouterOS!

https://docs.aws.amazon.com/cli/latest/topic/s3-config.html#max-bandwidth
