namespace AlienFarmHeist.Models;

public enum EnemyType
{
    Fighter = 0,
    Thief = 1,
    Elite = 2,
    Boss = 3,

    Interceptor = 4,
    Bomber = 5
}

public enum EnemyState
{
    Descending,
    Hovering,
    Beaming,
    Fleeing
}

public enum ScreenState
{
    Start,
    Shop,
    Playing,
    End
}

public enum BossVariant
{
    Scout = 0,
    Harvester = 1,
    War = 2
}

public enum EnemyProjectileKind
{
    Standard = 0,
    Interceptor = 1,
    BomberBomb = 2,
    WarMothership = 3
}

public class FarmItem
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public bool Safe { get; set; } = true;

    /// <summary>
    /// Fixed horizontal position where this item stands in the field,
    /// so thieves and harvesters can visibly steer toward it.
    /// </summary>
    public double FieldX;
}

public class Bullet
{
    public Guid Id { get; } = Guid.NewGuid();

    public double X;
    public double Y;

    public double Vx;
    public double Vy;

    // Used by Ted's projectiles.
    public bool IsFlame;

    // Used by enemy projectiles.
    public EnemyProjectileKind EnemyKind =
        EnemyProjectileKind.Standard;
}

public class Enemy
{
    public Guid Id { get; } = Guid.NewGuid();

    public double X;
    public double Y;

    public double Vy;
    public double VxBase;

    public double Phase;
    public double Wobble;

    public double StealZoneY;
    public double ShootTimer;

    public double PatrolY;
    public double HoverTimer;

    public int Hp;
    public int MaxHp;

    public EnemyType Type;

    public EnemyState State =
        EnemyState.Descending;

    // Only meaningful when Type == Boss.
    public BossVariant BossVariant =
        BossVariant.Scout;

    /// <summary>
    /// The farm item currently targeted by a Thief or Harvester.
    /// </summary>
    public string? TargetItemId;

    /// <summary>
    /// Fixed field position of the targeted farm item.
    /// </summary>
    public double TargetFieldX;

    /// <summary>
    /// Set when a Thief successfully steals an item.
    /// Killing the fleeing Thief can restore it.
    /// </summary>
    public string? StolenItemId;

    /// <summary>
    /// Amount of time spent actively beaming a farm item.
    /// Used by both Thieves and the Harvester boss.
    /// </summary>
    public double BeamElapsed;
}

public class DecorPlant
{
    public string Image = "";

    public double X;
    public double Y;
    public double W;
    public double H;
}

public class PowerUp
{
    public Guid Id { get; } = Guid.NewGuid();

    public double X;
    public double Y;
    public double Vy;

    public string Key = "";
    public string Icon = "";
    public string Label = "";
}

public class CoinPickup
{
    public Guid Id { get; } = Guid.NewGuid();

    public double X;
    public double Y;
    public double Vy;

    public int Value = 1;
}

public enum ExplosionSize
{
    Small,
    Medium,
    Large
}

public class Explosion
{
    public Guid Id { get; } = Guid.NewGuid();

    public double X;
    public double Y;
    public double Age;

    public ExplosionSize Size;

    public const double Lifetime = 500;
}

public class BomberBlast
{
    public const double Lifetime = 450;

    public Guid Id { get; } = Guid.NewGuid();

    public double X { get; set; }
    public double Y { get; set; }

    public double Age { get; set; }
}

public class WobbleShot
{
    public Guid Id { get; } = Guid.NewGuid();

    public double X { get; set; }
    public double Y { get; set; }

    public double Vx { get; set; }
    public double Vy { get; set; }

    public int Damage { get; set; } = 1;
}

public class WobbleEgg
{
    public Guid Id { get; } = Guid.NewGuid();

    public double X { get; set; }
    public double Y { get; set; }

    public double Vx { get; set; }
    public double Vy { get; set; }

    public double Age { get; set; }
    public double Rotation { get; set; }

    public int Damage { get; set; } = 2;
}

public class WobbleEggBlast
{
    public const double Lifetime = 450;

    public Guid Id { get; } = Guid.NewGuid();

    public double X { get; set; }
    public double Y { get; set; }

    public double Age { get; set; }
}