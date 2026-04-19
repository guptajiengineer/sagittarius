export interface ErrorResponse {
  error: string;
  message: string;
  fields?: Record<string, string>;
  request_id: string;
}
