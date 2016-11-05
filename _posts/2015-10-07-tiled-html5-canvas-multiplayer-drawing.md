---
layout: post
title:  "Tiled HTML5 Canvas Multiplayer Drawing"
date:   2015-10-07 20:55:24 +1300
category: development
comments: true
tags: udraw canvas html5 javascript nodejs rest websocket development
---
There are far too may tutorials out there describing how to create a NodeJS app which either involves real time chat or drawing. A couple of years back I was amazed at how easy it was to write 12 lines of JavaScript code, chuck in a ```<canvas>``` element with some mousemove listeners in a page and type ```node server.js``` and away it goes!

Since then I've always thought it would be cool to extend the size of the drawing space to become an unlimited sized canvas? Well that's what I hope to have working soon.

Initially I set about writing a JavaScript HTML5 canvas map framework to allow tiles to be requested and drawn on screen but this involved inventing up coordinate systems, panning animations and dealing with tile grid boundaries. It got quite complex all while I was thinking *there must be a JavaScript library already for this!* Most JavaScript mapping libraries render ```<img>```tags in a mosaic fashion and animate the CSS 'top', 'left' or translate(x,y) properties coupled with event listeners to give the effect of a scrollable map. This won't work for a drawing app where the user should be interacting with one single canvas where shapes and lines can be drawn on efficiently. The only library I could find was OpenLayers 3 which supports map tile rendering on a single canvas element.

The canvas element will span the entire browser screen and gets divided up into tiles which can be retrieved and saved from a server using a RESTful API. This might be a great opportunity to experiment with the new HTTP/2 (formerly known as SPDY) server implementations as it may enable the ability to request a region and receive a range of adjacent tiles all in one response rather than requesting each one. I am currently using a small Java JAX-RS 2.0 implementation in Tomcat but might switch to a more productive framework such as Rails or Python Flask.

Real time user events such as mouse move events from other people will be sent down a WebSocket connection and relayed to all connected users to display a cursor where others are drawing.

With GET and PUT operations working, hopefully there will be a working prototype for people to try out very soon in the browser.
