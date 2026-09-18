using System.Text.Json;
using Microsoft.JSInterop;

namespace AlienFarmHeist.Models;

/// <summary>
/// Survives between runs (and between browser sessions on the same device),
/// stored as one JSON blob in the browser's localStorage. Blazor's built-in
/// JS interop can call localStorage directly -- no custom JS file needed.
/// </summary>
public class GameProgress
{
    public int TotalCoins { get; set; }
    public int BestScore { get; set; }
    public int LifeLevel { get; set; }
    public int FireRateLevel { get; set; }
    public int SpeedLevel { get; set; }
    public int PowerupLevel { get; set; }

    public const int MaxLevel = 5;
    const string StorageKey = "alienFarmHeist.progress.v1";

    public static readonly (string Key, string Label, string Description, int BaseCost)[] Upgrades = new[]
    {
        ("life", "Extra Toughness", "+1 starting life per level", 40),
        ("fireRate", "Rapid Trigger", "Ted's base fire rate gets faster", 35),
        ("speed", "Quick Boots", "Move side to side faster", 30),
        ("powerup", "Lucky Harvest", "UFOs drop power-ups more often", 45),
    };

    public int LevelFor(string key) => key switch
    {
        "life" => LifeLevel,
        "fireRate" => FireRateLevel,
        "speed" => SpeedLevel,
        "powerup" => PowerupLevel,
        _ => 0,
    };

    public void SetLevel(string key, int value)
    {
        switch (key)
        {
            case "life": LifeLevel = value; break;
            case "fireRate": FireRateLevel = value; break;
            case "speed": SpeedLevel = value; break;
            case "powerup": PowerupLevel = value; break;
        }
    }

    public static int CostFor(string key, int currentLevel)
    {
        var baseCost = Upgrades.First(u => u.Key == key).BaseCost;
        return baseCost * (currentLevel + 1);
    }

    public static async Task<GameProgress> LoadAsync(IJSRuntime js)
    {
        try
        {
            var json = await js.InvokeAsync<string?>("localStorage.getItem", StorageKey);
            if (!string.IsNullOrEmpty(json))
            {
                var loaded = JsonSerializer.Deserialize<GameProgress>(json);
                if (loaded != null) return loaded;
            }
        }
        catch { /* first run, corrupted data, or storage blocked -- fall back to fresh progress */ }
        return new GameProgress();
    }

    public async Task SaveAsync(IJSRuntime js)
    {
        try
        {
            var json = JsonSerializer.Serialize(this);
            await js.InvokeVoidAsync("localStorage.setItem", StorageKey, json);
        }
        catch { /* storage blocked (private browsing etc.) -- progress just won't persist */ }
    }
}
