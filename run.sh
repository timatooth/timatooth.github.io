#!/usr/bin/env bash

export JEKYLL_VERSION=4.2
mkdir -p /tmp/jekyllbundlecache
docker run --rm \
  --volume="$PWD:/srv/jekyll" \
  --volume="/tmp/jekyllbundlecache:/usr/local/bundle" \
  -p 4000:4000 \
  -p 35729:35729 \
  -it jekyll/jekyll:$JEKYLL_VERSION \
  jekyll serve --livereload --drafts --verbose
