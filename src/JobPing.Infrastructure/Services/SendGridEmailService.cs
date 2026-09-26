using JobPing.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace JobPing.Infrastructure.Services;

public class SendGridEmailService : IEmailService
{
    private readonly ISendGridClient _client;
    private readonly string _fromEmail;
    private readonly string _fromName;

    public SendGridEmailService(IConfiguration config)
    {
        var apiKey = config["SendGrid:ApiKey"] ?? string.Empty;
        _client = new SendGridClient(apiKey);
        _fromEmail = config["SendGrid:FromEmail"] ?? "noreply@jobping.dev";
        _fromName = config["SendGrid:FromName"] ?? "JobPing";
    }

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        var from = new EmailAddress(_fromEmail, _fromName);
        var toAddress = new EmailAddress(to);
        var message = MailHelper.CreateSingleEmail(from, toAddress, subject, plainTextContent: null, htmlContent: htmlBody);

        var response = await _client.SendEmailAsync(message);
        if ((int)response.StatusCode >= 400)
        {
            var body = await response.Body.ReadAsStringAsync();
            throw new InvalidOperationException($"SendGrid returned {(int)response.StatusCode}: {body}");
        }
    }
}
