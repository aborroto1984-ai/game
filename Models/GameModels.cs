namespace AlienFarmHeist.Models;

public enum EnemyType { Fighter, Thief, Elite, Boss }
public enum EnemyState { Descending, Hovering, Beaming, Fleeing }
public enum ScreenState { Start, Shop, Playing, End }

public class FarmItem
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public bool Safe { get; set; } = true;
    /// <summary>Fixed horizontal position where this item stands in the field, so thieves can visibly steer toward it.</summary>
    public double FieldX;
}

public class Bullet
{
    public Guid Id { get; } = Guid.NewGuid();
    public double X, Y, Vx, Vy;
    public bool IsFlame;
}

public class Enemy
{
    public Guid Id { get; } = Guid.NewGuid();
    public double X, Y, Vy, VxBase, Phase, Wobble, StealZoneY, ShootTimer;
    public double PatrolY, HoverTimer;
    public int Hp, MaxHp;
    public EnemyType Type;
    public EnemyState State = EnemyState.Descending;
    /// <summary>Only set for thieves: the specific item this ship is going for. Shown as a badge above it.</summary>
    public string? TargetItemId;
    /// <summary>The target item's fixed field X position, so the ship visibly steers toward it while descending.</summary>
    public double TargetFieldX;
    /// <summary>Set once a thief actually completes a steal, so killing it while it flees can give the item back.</summary>
    public string? StolenItemId;
    /// <summary>How long this thief has been hovering and beaming its target up (ms). Shooting it down before this completes saves the item entirely.</summary>
    public double BeamElapsed;
}

public class DecorPlant
{
    public string Image = "";
    public double X, Y, W, H;
}

public class PowerUp
{
    public Guid Id { get; } = Guid.NewGuid();
    public double X, Y, Vy;
    public string Key = "", Icon = "", Label = "";
}

public class CoinPickup
{
    public Guid Id { get; } = Guid.NewGuid();
    public double X, Y, Vy;
    public int Value = 1;
}

public enum ExplosionSize { Small, Medium, Large }

public class Explosion
{
    public Guid Id { get; } = Guid.NewGuid();
    public double X, Y, Age;
    public ExplosionSize Size;
    public const double Lifetime = 500;
}
