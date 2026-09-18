Drop your audio files in this folder with these exact names:

MUSIC (loops automatically):
  music_intro.mp3        - title/start screen
  music_shop.mp3         - upgrade shop screen
  music_gameplay_1.mp3   - gameplay track A (picked at random each run)
  music_gameplay_2.mp3   - gameplay track B (picked at random each run)
  music_lose.mp3         - loss screen

SOUND EFFECTS (one-shot):
  sfx_wave_start.mp3     - plays when a new wave begins
  sfx_beam_deploy.wav    - plays when a thief ship locks its tractor beam onto a target
  sfx_powerup.wav        - plays when a power-up is collected
  sfx_coin.wav           - plays when a coin is collected
  sfx_bullet.mp3         - plays each time Ted fires (normal/wide shot; flamethrower spray is silent to avoid spam)
  sfx_hit.wav            - plays when Ted takes damage
  sfx_explosion_1.wav    - explosion sound 1
  sfx_explosion_2.wav    - explosion sound 2

Any common web audio format works (mp3 recommended for broadest browser support;
.ogg or .wav also fine -- just keep the same base filename and update the
extension in Pages/Game.razor's PlayMusic/PlaySfx calls if you use something
other than .mp3).

Nothing else needs to change -- the game already calls these files by name.
