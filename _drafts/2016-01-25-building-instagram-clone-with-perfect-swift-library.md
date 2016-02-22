---
layout: post
title:  "Building an Instagram Clone with Perfect Swift Library"
date:   2016-01-25 20:00:24 +1300
category: development
tags: ios swift perfect
---

When Apple announced they were going to open source their Swift language
I immediately wondered if we would see it running the backends to webservices
where frameworks and languages such as PHP, Python with Django, Java ruling the
roost.

## Perfect Server and library first look

Today without any previous experience in using the software I'm going to have a
crack at creating a very basic Instagram clone app using a RESTful interface
for the app with the bundled Perfect HTTPServer.

The examples included with Perfect already have an authenticator app and WebSocket
examples which will be used so a user can register on first run and a simple web
page will display the latest photo posts in a live news feed format using React.

Images and users will be stored in a quick and dirty MongoDB database.

note Swift PaaS?
