$(document).ready(function(){

  //flickr section
  var url = "https://api.flickr.com/services/rest/?method=flickr.people.getPublicPhotos&api_key=e5ef2e82f48aca40ed07ff8088751679&user_id=96588525%40N04&safe_search=&format=json&nojsoncallback=1&auth_token=72157665000092795-fe22a7a4d57a521a&api_sig=7a162cdfd5e31e65d8af3f1aef8a9a56"
  var images = {}
  var index = 0;
  var page = 0;
  var loadCount = 20;
  var $grid = $('.photogrid');

  var requestImage = function(id, cb){
    var query = "https://api.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key=bc013c6475350772aca45f2ee294d3a7&photo_id=" + id + "&format=json&nojsoncallback=1"
    $.getJSON(query, function(data){
      cb(data);
    })
  }

  $.getJSON(url, function(res){
    if (res.stat === 'ok'){
      for (var i = 0; i < loadCount; i++){
        requestImage(res.photos.photo[i].id, function(image){
          var mimage = image.sizes.size[6]
          var newImage = $('<div class="photo-item"><img src="' + mimage.source + '" /></div>');
          $grid.append(newImage);
        });
      }
    }
  })
})
