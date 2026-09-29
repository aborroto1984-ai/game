namespace AlienFarmHeist.Models
{
    public sealed class PlayerProfileDto
    {
        public string PlayerId { get; set; } = string.Empty;
        public string PlayerName { get; set; } = string.Empty;

        public int TotalCoins { get; set; }
        public int BestScore { get; set; }
        public int BestWave { get; set; }

        public int LifeLevel { get; set; }
        public int FireRateLevel { get; set; }
        public int SpeedLevel { get; set; }
        public int PowerupLevel { get; set; }
    }

    public sealed record PlayerSession(
        string PlayerId,
        string PlayerToken);
}
