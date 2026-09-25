namespace AlienFarmHeist.Models;

/// <summary>
/// Maps game entities to their PNG sprite under wwwroot/images.
/// Swap any file in wwwroot/images to change art without touching game code.
/// </summary>
public static class Sprites
{
    public const string Farmer = "images/farmer.png";
    public const string FarmerFlame = "images/farmer_flame.png";

    // Wobble
    public const string WobbleStanding = "images/wobble_standing.png";
    public const string WobbleLeftLeg = "images/wobble_leftLeg.png";
    public const string WobbleRightLeg = "images/wobble_rightLeg.png";

    public const string WobbleStandingRage = "images/wobble_standing_rage.png";
    public const string WobbleLeftLegRage = "images/wobble_leftLeg_rage.png";
    public const string WobbleRightLegRage = "images/wobble_rightLeg_rage.png";

    public const string WobbleKernel = "images/kernel.png";
    public const string WobbleEgg = "images/egg.png";
    public const string WobbleEggExplosion = "images/egg_explosion.png";

    public const string UfoFighter = "images/ufo_fighter.png";
    public const string UfoThief = "images/ufo_thief.png";
    public const string UfoElite = "images/ufo_elite.png";
    public const string UfoBoss = "images/ufo_boss.png";

    public const string Coin = "images/coin.png";
    public const string Background = "images/background.png";
    public const string Cover = "images/cover.jpg";
    public const string ShopBackground = "images/shop_bg.jpg";

    public const string FxSmallExplosion = "images/fx_small_explosion.png";
    public const string FxMediumExplosion = "images/fx_medium_explosion.png";
    public const string FxLargeExplosion = "images/fx_large_explosion.png";
    public const string FxContinuousFire = "images/fx_continuous_fire.png";
    public const string FxBeamColumn = "images/fx_beam_column.png";
    public const string FxBeamFocus = "images/fx_beam_focus.png";

    public const string TedBullet = "images/ted_bullet.png";
    public const string TedFlameBurst = "images/ted_flame_burst.png";

    public const string UfoInterceptor = "images/ufo_interceptor.png";
    public const string UfoBomber = "images/ufo_bomber.png";

    public const string UfoBossScout = "images/ufo_boss_scout.png";
    public const string UfoBossHarvester = "images/ufo_boss_harvester.png";
    public const string UfoBossWar = "images/ufo_boss_war.png";

    public const string InterceptorShot = "images/interceptor_shot.png";
    public const string BomberBomb = "images/bomber_bomb.png";
    public const string BomberBlast = "images/bomber_blast.png";

    public const string HarvesterBeamEmitter = "images/harvester_beam_emitter.png";
    public const string WarMothershipShot = "images/war_mothership_shot.png";

    public static string ForUpgrade(string key) => key switch
    {
        "life" => "images/upgrade_life.png",
        "fireRate" => "images/upgrade_firerate.png",
        "speed" => "images/upgrade_speed.png",
        "powerup" => "images/upgrade_powerup.png",
        _ => "",
    };

    public static string ForItem(string id) => id switch
    {
        "cow" => "images/cow.png",
        "chicken" => "images/chicken.png",
        "tractor" => "images/tractor.png",
        "truck" => "images/truck.png",
        "corn" => "images/corn.png",
        "pumpkin" => "images/pumpkin.png",
        "wife" => "images/wife.png",
        _ => "",
    };

    public static string ForPower(string key) => key switch
    {
        "rapid" => "images/power_rapid.png",
        "wide" => "images/power_wide.png",
        "shield" => "images/power_shield.png",
        "life" => "images/power_life.png",
        "flame" => FxContinuousFire,
        _ => "",
    };
}