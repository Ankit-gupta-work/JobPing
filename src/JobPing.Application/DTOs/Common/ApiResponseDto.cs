namespace JobPing.Application.DTOs.Common;

public class ApiResponseDto<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; }

    public static ApiResponseDto<T> Ok(T data, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static ApiResponseDto<T> Fail(string message) =>
        new() { Success = false, Data = default, Message = message };
}
