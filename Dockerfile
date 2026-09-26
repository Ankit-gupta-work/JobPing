# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["src/JobPing.API/JobPing.API.csproj", "src/JobPing.API/"]
COPY ["src/JobPing.Application/JobPing.Application.csproj", "src/JobPing.Application/"]
COPY ["src/JobPing.Infrastructure/JobPing.Infrastructure.csproj", "src/JobPing.Infrastructure/"]
COPY ["src/JobPing.Domain/JobPing.Domain.csproj", "src/JobPing.Domain/"]

RUN dotnet restore "src/JobPing.API/JobPing.API.csproj"

COPY src/ src/
RUN dotnet publish "src/JobPing.API/JobPing.API.csproj" -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# The official image defaults to 8080 since .NET 8 (ASPNETCORE_HTTP_PORTS), not 80 —
# override explicitly so EXPOSE 80 / docker-compose's "5000:80" / nginx's "server api:80"
# all actually match what the container listens on.
ENV ASPNETCORE_HTTP_PORTS=80
EXPOSE 80

ENTRYPOINT ["dotnet", "JobPing.API.dll"]
