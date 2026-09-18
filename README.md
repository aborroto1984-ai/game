# Alien Farm Heist 🛸🚜

A Blazor WebAssembly game (C#, no JavaScript needed). Move Farmer Ted
side to side, auto-shoot upward, and stop alien UFOs from stealing his
cow, chicken, tractor, truck, corn, pumpkins — and his wife.

## Run it locally (Visual Studio)

1. Install the **.NET 8 SDK** if you don't have it: https://dotnet.microsoft.com/download/dotnet/8.0
2. Open `AlienFarmHeist.csproj` in Visual Studio 2022 (17.8+), with the
   **ASP.NET and web development** workload installed.
3. Press **F5** (or Ctrl+F5). It launches in your browser.

Or from the command line:
```
dotnet run
```

## Deploy to GitHub Pages (free hosting)

This repo already includes `.github/workflows/deploy.yml`, which builds
the app and publishes it to a `gh-pages` branch automatically every time
you push to `main`.

One-time setup after you push this project to GitHub:

1. Push the repo to GitHub (`git push origin main`).
2. Wait for the "Deploy to GitHub Pages" action to finish (check the
   **Actions** tab) — it creates a `gh-pages` branch for you.
3. Go to **Settings → Pages** on your GitHub repo.
4. Under "Build and deployment", set **Source** to "Deploy from a
   branch", branch **gh-pages**, folder **/ (root)**. Save.
5. Your game will be live at:
   `https://<your-username>.github.io/<repo-name>/`

After that first setup, every future push to `main` redeploys
automatically — nothing else to configure.

### If the page loads blank on GitHub Pages

That almost always means the `<base href>` doesn't match your repo
name. The workflow sets it automatically based on the repo name, but if
you renamed the repo or are deploying somewhere other than
`username.github.io/reponame/`, open `wwwroot/index.html` and check the
`<base href="/..." />` line matches your actual path.

## Project structure

```
AlienFarmHeist.csproj      project file (Blazor WebAssembly, .NET 8)
Program.cs                 app entry point
App.razor                  router
Layout/MainLayout.razor    page layout wrapper
Pages/Game.razor           the entire game (markup + C# game loop)
Models/GameModels.cs        Enemy, Bullet, PowerUp, FarmItem, Star classes
wwwroot/index.html         host page
wwwroot/css/app.css        all game styling
.github/workflows/deploy.yml   auto-deploy to GitHub Pages
```

## Tuning the game

Everything gameplay-related lives in `Pages/Game.razor`'s `@code`
block:
- `spawnInterval` / `difficulty` — how fast aliens ramp up over time
- `ItemDefs` — the list of stealable farm items (swap "wife" for
  anything else here if you want a different joke)
- `PowerupDefs` — the four power-ups and their effect durations
- `fireRate` — how often the farmer auto-fires
