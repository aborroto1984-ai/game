namespace AlienFarmHeist.Models
{
    public sealed class LeaderboardEntryDto
    {
        public int Rank { get; set; }
        public string PlayerName { get; set; } = string.Empty;
        public int Score { get; set; }
        public int Wave { get; set; }
    }
}
