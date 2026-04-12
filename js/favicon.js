(function () {
  var picked = 'icons/hash.webp';
  var img = document.getElementById('headerLogo');
  if (img) img.src = picked;
  var image = new Image();
  image.onload = function () {
    var s = Math.min(image.naturalWidth, image.naturalHeight);
    var sx = (image.naturalWidth - s) / 2;
    var sy = (image.naturalHeight - s) / 2;
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    canvas.getContext('2d').drawImage(image, sx, sy, s, s, 0, 0, 64, 64);
    var link = document.getElementById('siteIcon');
    if (link) { link.href = canvas.toDataURL(); link.type = 'image/png'; }
  };
  image.src = picked;
})();
