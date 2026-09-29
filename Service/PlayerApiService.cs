using AlienFarmHeist.Models;
using Microsoft.JSInterop;
using System;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace AlienFarmHeist.Services;

public sealed class PlayerApiService
{
    private const string PlayerIdKey =
        "alienFarmHeist.playerId.v1";

    private const string PlayerTokenKey =
        "alienFarmHeist.playerToken.v1";

    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = true
        };

    private readonly HttpClient _http;
    private readonly IJSRuntime _js;
    private readonly string _baseUrl;

    public PlayerApiService(
        HttpClient http,
        IJSRuntime js,
        IConfiguration configuration)
    {
        _http = http;
        _js = js;

        _baseUrl =
            configuration[
                "AlienFarmApi:BaseUrl"]
                ?.TrimEnd('/')
            ?? throw new InvalidOperationException(
                "AlienFarmApi:BaseUrl is missing.");
    }

    public async Task<PlayerSession?>
        GetSessionAsync()
    {
        var playerId =
            await _js.InvokeAsync<string?>(
                "localStorage.getItem",
                PlayerIdKey);

        var playerToken =
            await _js.InvokeAsync<string?>(
                "localStorage.getItem",
                PlayerTokenKey);

        if (string.IsNullOrWhiteSpace(playerId) ||
            string.IsNullOrWhiteSpace(playerToken))
        {
            return null;
        }

        return new PlayerSession(
            playerId,
            playerToken);
    }

    public async Task<(PlayerSession Session,
                   PlayerProfileDto Player,
                   string RecoveryCode)>
    CreatePlayerAsync(string playerName)
    {
        using var response =
            await _http.PostAsJsonAsync(
                $"{_baseUrl}/api/players",
                new
                {
                    playerName
                });

        var result =
            await ReadResponseAsync(
                response);

        if (result.Player == null ||
            string.IsNullOrWhiteSpace(
                result.PlayerToken))
        {
            throw new InvalidOperationException(
                "Player creation returned an invalid response.");
        }

        var session =
            new PlayerSession(
                result.Player.PlayerId,
                result.PlayerToken);

        await SaveSessionAsync(
            session);

        return (
            session,
            result.Player,
            result.RecoveryCode
                ?? throw new InvalidOperationException(
                    "Recovery code was not returned."));
    }

    public async Task<PlayerProfileDto>
        GetPlayerAsync(
            PlayerSession session)
    {
        using var response =
            await _http.GetAsync(
                $"{_baseUrl}/api/players/{session.PlayerId}");

        var result =
            await ReadResponseAsync(
                response);

        return result.Player
            ?? throw new InvalidOperationException(
                "Player was not returned by the API.");
    }

    public async Task<PlayerProfileDto>
        SubmitRunAsync(
            PlayerSession session,
            int score,
            int wave,
            int coinsEarned)
    {
        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                $"{_baseUrl}/api/runs");

        request.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                session.PlayerToken);

        request.Content =
            JsonContent.Create(
                new
                {
                    playerId =
                        session.PlayerId,

                    score,
                    wave,
                    coinsEarned
                });

        using var response =
            await _http.SendAsync(
                request);

        var result =
            await ReadResponseAsync(
                response);

        return result.Player
            ?? throw new InvalidOperationException(
                "Updated player was not returned.");
    }

    public async Task<PlayerProfileDto>
        PurchaseUpgradeAsync(
            PlayerSession session,
            string upgrade)
    {
        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                $"{_baseUrl}/api/upgrades");

        request.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                session.PlayerToken);

        request.Content =
            JsonContent.Create(
                new
                {
                    playerId =
                        session.PlayerId,

                    upgrade
                });

        using var response =
            await _http.SendAsync(
                request);

        var result =
            await ReadResponseAsync(
                response);

        return result.Player
            ?? throw new InvalidOperationException(
                "Updated player was not returned.");
    }

    private async Task SaveSessionAsync(
        PlayerSession session)
    {
        await _js.InvokeVoidAsync(
            "localStorage.setItem",
            PlayerIdKey,
            session.PlayerId);

        await _js.InvokeVoidAsync(
            "localStorage.setItem",
            PlayerTokenKey,
            session.PlayerToken);
    }

    private static async Task<ApiResponse>
        ReadResponseAsync(
            HttpResponseMessage response)
    {
        var json =
            await response.Content
                .ReadAsStringAsync();

        var result =
            JsonSerializer.Deserialize<ApiResponse>(
                json,
                JsonOptions)
            ?? new ApiResponse();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                result.Error
                ?? result.Message
                ?? "Alien Farm API request failed.");
        }

        return result;
    }

    public async Task<List<LeaderboardEntryDto>>
        GetLeaderboardAsync()
    {
        using var response =
            await _http.GetAsync(
                $"{_baseUrl}/api/leaderboard");

        var result =
            await ReadResponseAsync(
                response);

        return result.Leaderboard
            ?? new List<LeaderboardEntryDto>();
    }

    public async Task<(PlayerSession Session,
                   PlayerProfileDto Player)>
    RecoverPlayerAsync(
        string playerName,
        string recoveryCode)
    {
        using var response =
            await _http.PostAsJsonAsync(
                $"{_baseUrl}/api/players/recover",
                new
                {
                    playerName,
                    recoveryCode
                });

        var result =
            await ReadResponseAsync(
                response);

        if (result.Player == null ||
            string.IsNullOrWhiteSpace(
                result.PlayerToken))
        {
            throw new InvalidOperationException(
                "Recovery returned an invalid response.");
        }

        var session =
            new PlayerSession(
                result.Player.PlayerId,
                result.PlayerToken);

        await SaveSessionAsync(
            session);

        return (
            session,
            result.Player);
    }

    public async Task<string>
    CreateRecoveryCodeAsync(
        PlayerSession session)
    {
        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                $"{_baseUrl}/api/players/recovery-code");

        request.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                session.PlayerToken);

        request.Content =
            JsonContent.Create(
                new
                {
                    playerId =
                        session.PlayerId
                });

        using var response =
            await _http.SendAsync(
                request);

        var result =
            await ReadResponseAsync(
                response);

        if (string.IsNullOrWhiteSpace(
            result.RecoveryCode))
        {
            throw new InvalidOperationException(
                "Recovery code was not returned.");
        }

        return result.RecoveryCode;
    }

    private sealed class ApiResponse
    {
        public bool Ok { get; set; }

        public string? Error { get; set; }
        public string? Message { get; set; }

        public string? PlayerToken { get; set; }

        public string? RecoveryCode { get; set; }

        public PlayerProfileDto? Player { get; set; }

        public List<LeaderboardEntryDto>? Leaderboard { get; set; }
    }
}