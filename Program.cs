using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using AlienFarmHeist;
using AlienFarmHeist.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.Services.AddScoped(
    sp => new HttpClient
    {
        BaseAddress =
            new Uri(
                builder.HostEnvironment.BaseAddress)
    });

builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");
builder.Services.AddScoped<PlayerApiService>();

await builder.Build().RunAsync();
