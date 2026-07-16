/**
 * Branded HTML for roomd invite emails.
 * Table-based layout for email client compatibility (similar to react-email).
 */

const PRIMARY = "#1a9e48";
const PRIMARY_SOFT = "#e8f7ee";
const PRIMARY_BORDER = "#b7e4c7";
const INK = "#18181b";
const MUTED = "#71717a";
const BORDER = "#e7e5e4";
const BG = "#f4f4f5";

export function buildInviteEmailHtml(args: {
  key: string;
  loginUrl: string;
  who: string;
  scope: string;
  preheader?: string;
}): string {
  const { key, loginUrl, who, scope } = args;
  const preheader =
    args.preheader ?? "Your roomd access key — sign in and open your private workspace.";
  const site = "https://roomd.sh";
  const safeKey = escapeHtml(key);
  const safeLogin = escapeHtml(loginUrl);
  const safeWho = escapeHtml(who);
  const safeScope = escapeHtml(scope);

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
<head>
  <meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your roomd invite</title>
</head>
<body style="background-color:${BG};margin:0;padding:0">
  <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
    ${escapeHtml(preheader)}
  </div>
  <table border="0" width="100%" cellPadding="0" cellSpacing="0" role="presentation" align="center">
    <tbody>
      <tr>
        <td style="background-color:${BG};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;margin:0;padding:32px 0">
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:560px;margin:0 auto;padding:0 16px">
            <tbody>
              <tr>
                <td>
                  <!-- Brand -->
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:4px 0 24px">
                    <tbody>
                      <tr>
                        <td>
                          <a href="${site}" style="text-decoration:none" target="_blank">
                            <table border="0" cellPadding="0" cellSpacing="0" role="presentation">
                              <tbody>
                                <tr>
                                  <td style="vertical-align:middle;padding-right:10px">
                                    <div style="width:22px;height:22px;background-color:${PRIMARY};border-radius:6px;line-height:22px;text-align:center">
                                      <span style="display:inline-block;width:6px;height:6px;background-color:#ffffff;border-radius:2px;vertical-align:middle"></span>
                                    </div>
                                  </td>
                                  <td style="vertical-align:middle">
                                    <span style="color:${INK};font-size:18px;font-weight:700;letter-spacing:-0.02em">roomd</span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Card -->
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="background-color:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden">
                    <tbody>
                      <tr>
                        <td>
                          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="background-color:${PRIMARY};height:4px;line-height:4px">
                            <tbody><tr><td>&nbsp;</td></tr></tbody>
                          </table>
                          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:32px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                            <tbody>
                              <tr>
                                <td>
                                  <p style="font-size:12px;line-height:24px;color:${PRIMARY};font-weight:700;letter-spacing:0.08em;margin:0 0 10px;text-transform:uppercase">You're in</p>
                                  <h1 style="color:${INK};font-size:26px;font-weight:700;line-height:1.2;margin:0 0 16px">Welcome to roomd</h1>
                                  <p style="font-size:16px;line-height:1.65;color:${INK};margin:0 0 14px">${safeWho} to <strong>roomd</strong>.</p>
                                  <p style="font-size:16px;line-height:1.65;color:${INK};margin:0 0 14px">${safeScope}</p>

                                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="background-color:${PRIMARY_SOFT};border:1px solid ${PRIMARY_BORDER};border-radius:10px;margin:8px 0 8px">
                                    <tbody>
                                      <tr>
                                        <td style="padding:18px 20px">
                                          <p style="font-size:12px;line-height:1.4;color:${MUTED};font-weight:600;letter-spacing:0.04em;margin:0 0 8px;text-transform:uppercase">Your API key</p>
                                          <p style="font-size:14px;line-height:1.5;color:${INK};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;margin:0;word-break:break-all">${safeKey}</p>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>

                                  <p style="font-size:14px;line-height:1.6;color:${MUTED};margin:16px 0 0">Keep this key somewhere safe. Anyone with it can access your workspace.</p>

                                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding-top:26px">
                                    <tbody>
                                      <tr>
                                        <td>
                                          <a href="${safeLogin}" style="color:#ffffff;background-color:${PRIMARY};border-radius:8px;display:inline-block;font-size:15px;font-weight:600;padding:13px 24px;text-decoration:none" target="_blank">Sign in to roomd&nbsp;→</a>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <!-- Footer -->
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:22px 8px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                    <tbody>
                      <tr>
                        <td>
                          <hr style="width:100%;border:none;border-top:1px solid ${BORDER};margin:0 0 16px"/>
                          <p style="font-size:12px;line-height:1.6;color:${MUTED};margin:0;text-align:center">
                            <a href="${site}" style="color:${MUTED};text-decoration:underline" target="_blank">roomd.sh</a>
                            &nbsp;&nbsp;·&nbsp;&nbsp;
                            <a href="${site}/protocol" style="color:${MUTED};text-decoration:underline" target="_blank">Protocol</a>
                            &nbsp;&nbsp;·&nbsp;&nbsp;
                            <a href="${safeLogin}" style="color:${MUTED};text-decoration:underline" target="_blank">Sign in</a>
                          </p>
                          <p style="font-size:12px;line-height:1.6;color:${MUTED};margin:8px 0 0;text-align:center">Shared-state coordination for AI coding agents</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
