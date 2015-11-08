---
layout: post
title:  "udraw: Multiplayer Drawing Canvas"
date:   2015-11-08 20:00:00 +1300
categories: development
tags: web design static
---
_udraw_ is a multiplayer drawing application like many other drawing apps out there which have surfaced since the rise of WebSockets. Mine happens to expand in size allowing very large drawings on an (unlimited?) sized surface. Each area of the canvas is broken into 256x256 pixel tiles which are drawn on a single HTML5 canvas seamlessly to make drawing on a large canvas possible. Here it is embedded below. Alternatively you can visit the full version at [https://udraw.me](https://udraw.me)

<iframe src="https://udraw.me" height="600" width="680" frameborder="0" style=" max-width: 100%; height: 600px;"></iframe>

Panning around updates the URL to display your current location. This enables people to link to the same visible region. This is thanks to the browser history API.

The UI has the basics such as brush, pencil, colour picker along with the ability to move around with WASD key bindings and mobile touch gestures. When a draw stroke finishes all the changed tiles are set _dirty_ and then sent server side with a http **PUT** request. I hope to implement partial updates of a tile region by sending a **PATCH** request 'diff' rather than sending the entire tile to save bandwidth.

I was originally going to extend a JavaScript map library to add the drawing interface and saving on top. Most map libraries use the [Spherical Mercator Projection](https://en.wikipedia.org/wiki/Mercator_projection) but I'm glad I didn't for mathematical nightmare reasons. It would have been cool to use a Mercator projection to allow the drawings to be mapped onto a sphere in WebGL. Maybe another time!

Another possible area that needs exploring is the ability to store diffs of the pixel data in some form of stack data structure on Redis. This would make undo rollback features possible. This might be quite easy in Redis with logging features it already has. For example keeping the last 20 update diffs of a given tile or have a TTL before flattening the image tile after a period of time.

A version hash could represent the latest state. ETags might be an ideal trick as these are sent when by the browser even on PUT update requests. If the tag has changed (by another person updating first) maybe try merge the changes together by getting the 'newest' changes applied on top of the current version in the client. It's not likely this would work well, much like pushing code when your code branch is behind a few commits. This is where WebSockets come to the half-useful rescue by trying to simulate the remote drawing action when two people are drawing in the same area in the hope that both clients interleave the latest image state from their screen. It doesn't work very well in many situations and browser vendors render lines and shadows quite differently on different OSs.

## The Back End
The back end is accessed with a simple RESTful interface for loading and saving tile regions. Realtime events such as mouse movement or tool changes are performed over WebSocket for browsers to simulate the realtime aspects. After many road blocks trying to use Java I switched back to the NodeJS, Express, Socket.IO combo.

I can spin up many nodejs worker processes sitting behind nginx. A single Redis server stores all the tile data and relays the Socket.IO events to the other running processes to keep everything in sync.

## A note on HTTP/2
Annoyingly NodeJS still does not support HTTP/2 out-of-the box due to issues around SSL libraries and Express appearing to be dyeing based on GitHub activity. Multiplexing might reduce the latency for requesting multiple tile resources to the browser. Another cool feature HTTP/2 has is the ability to send Server Push messages which could send down cache invalidations when a tile has been updated by another user. I managed to clean the dust off the C compiler and started playing with nghttp2 which has a high level Boost ASIO library which been quite painless to write the REST interface on. I haven't seen any significant speed improvements with HTTP/2 multiplexing. There are even some raising questions about its performance in high bandwidth usage applications and its potential to perform worse because of the extra overhead multiplexing streams over a single TCP pipe.

I will continue working on getting the bugs UI out in spare time and keep a watch on web app development with HTTP/2. I certainly don't think it's something you can just install and expect 40% speed improvements without any effort to tune what assets need pushed and how priorities and streams are handled.

## Image Processing
Another advantage of switching to C/C++ is a multitude of available native libraries for image processing such as using ImageMagick or make it smart with OpenCV or get silly with procedural texture generation. One big request everyone wants is zoom! Pre-cached down-sampled images could be requested to see the entire canvas of drawings. I don't think it would be easy to allow drawing on separate zoom levels as that might get quite expensive to keep all the levels up to date and not to mention the loss when drawing while zoomed out.

Another issue is removing dick pic drawings. That might be a fun and challenging area to explore with OpenCV. Being able to build a model derived from known dick pic drawings or use some form of cutting edge artificial neural networks to clean away rude drawings. I'll call it APDRA (Adaptive Penis Detection and Removal Algorithm).  Perhaps Google will already have plenty of research for this!
