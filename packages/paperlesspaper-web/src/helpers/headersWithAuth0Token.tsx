export default function headersWithAuth0Token(headers, { getState }) {
  const token = getState().auth.token;
  if (token) headers.set("authorization", `Bearer ${token}`);
  return headers;
}
