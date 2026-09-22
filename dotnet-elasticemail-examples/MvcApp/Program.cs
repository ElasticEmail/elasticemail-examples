using ElasticEmail.Api;
using ElasticEmail.Client;
using MvcApp;

DotNetEnv.Env.TraversePath().Load();

var apiKey = Environment.GetEnvironmentVariable("ELASTICEMAIL_API_KEY");
if (string.IsNullOrEmpty(apiKey))
{
    throw new Exception("ELASTICEMAIL_API_KEY environment variable is required");
}

var config = new Configuration();
config.AddApiKey("X-ElasticEmail-ApiKey", apiKey);

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddSingleton(new EmailsApi(config));
builder.Services.AddSingleton(new ContactsApi(config));
builder.Services.AddSingleton(new ListsApi(config));
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
{
    // Inbound emails carry base64 attachments in form fields
    o.ValueLengthLimit = 25 * 1024 * 1024;
    o.MultipartBodyLengthLimit = 25 * 1024 * 1024;
});

var app = builder.Build();
app.MapControllers();

var url = Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? $"http://localhost:{Ee.Env("PORT", "3001")}";
Console.WriteLine($"MVC server running on {url}");
app.Run(url);
