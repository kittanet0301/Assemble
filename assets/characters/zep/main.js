// Use any exported avatar-h*-s*.png as the fileName.
const avatar = App.loadSpritesheet('avatar-h0-s0.png', 48, 64, {"down": [0, 1, 2, 3], "left": [4, 5, 6, 7], "right": [8, 9, 10, 11], "up": [12, 13, 14, 15]}, 8);
App.onJoinPlayer.Add(function(player) { player.sprite = avatar; player.sendUpdated(); });
