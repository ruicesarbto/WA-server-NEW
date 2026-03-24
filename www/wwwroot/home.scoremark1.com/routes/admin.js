const pm2CliPath = require.resolve("pm2/bin/pm2");
const ACME_HOME = process.env.ACME_HOME || path.resolve(process.env.HOME || "/root", ".acme.sh");
const ACME_BIN = process.env.ACME_BIN || path.resolve(ACME_HOME, "acme.sh");
const ACME_ACCOUNT_FILE = process.env.SSL_ACCOUNT_FILE || path.resolve(ACME_HOME, "account.conf");
const REGISTER_COMMAND_TEMPLATE =
  process.env.SSL_REGISTER_COMMAND ||
  `${ACME_BIN} --register-account --server letsencrypt -m {{accountEmail}}`;
const ENV_FILE_PATH = path.resolve(__dirname, "../.env");

const SSL_CONFIG = {
   domain: process.env.SSL_PRIMARY_DOMAIN || "home.scoremark1.com",
   altDomains: (process.env.SSL_ALT_DOMAINS || "").split(",").map((item) => item.trim()).filter(Boolean),
   certPath:
     process.env.SSL_CERT_PATH || "/www/server/panel/vhost/ssl/home.scoremark1.com/fullchain.pem",
   keyPath:
     process.env.SSL_KEY_PATH || "/www/server/panel/vhost/ssl/home.scoremark1.com/privkey.pem",
   chainPath: process.env.SSL_CHAIN_PATH || null,
   issueCommand: process.env.SSL_ISSUE_COMMAND || "",
   reloadCommand: process.env.SSL_RELOAD_COMMAND || "nginx -s reload",
   historyFile: path.resolve(__dirname, "../logs/ssl-history.json"),
   registerCommand: REGISTER_COMMAND_TEMPLATE,
   acmeHome: ACME_HOME,
   acmeBinary: ACME_BIN,
   accountFile: ACME_ACCOUNT_FILE,
   accountEmailEnv: process.env.SSL_ACCOUNT_EMAIL || "",
 };

const buildCommand = (template, domains, extras = {}) => {
  if (!template) return "";
  const primary = domains[0] || "";
  const altDomains = domains.slice(1);
  const alt = altDomains.join(" ");
  const altWithFlags = altDomains.map((item) => (item ? `-d ${item}` : "")).filter(Boolean).join(" ");
  let command = template
    .replace(/\{\{domains\}\}/g, domains.join(" "))
    .replace(/\{\{domain\}\}/g, primary)
    .replace(/\{\{altDomainsWithFlags\}\}/g, altWithFlags)
    .replace(/\{\{altDomains\}\}/g, alt);
  Object.entries(extras).forEach(([key, value]) => {
    command = command.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value != null ? String(value) : "");
  });
  return command;
};

const appendSslHistory = async (entry) => {
  try {
    await ensureDirForFile(SSL_CONFIG.historyFile);
    const history = await readSslHistory(SSL_HISTORY_LIMIT - 1);
    history.unshift({
      timestamp: new Date().toISOString(),
      ...entry,
    });
    const trimmed = history.slice(0, SSL_HISTORY_LIMIT);
    await fsp.writeFile(SSL_CONFIG.historyFile, JSON.stringify(trimmed, null, 2));
  } catch (error) {
    console.error("SSL history append error:", error);
  }
};

const readAcmeAccountInfo = async () => {
  try {
    const content = await fsp.readFile(SSL_CONFIG.accountFile, "utf8");
    const emailMatch = content.match(/ACCOUNT_EMAIL=['"]?([^'"\n]+)['"]?/);
    const serverMatch = content.match(/DEFAULT_ACME_SERVER_v2=['"]?([^'"\n]+)['"]?/);
    return {
      registered: true,
      email: emailMatch ? emailMatch[1].trim() : null,
      server: serverMatch ? serverMatch[1].trim() : null,
      accountFile: SSL_CONFIG.accountFile,
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("ACME account read error:", error);
    }
    return {
      registered: false,
      email: null,
      server: null,
      accountFile: SSL_CONFIG.accountFile,
      error: error && error.code !== "ENOENT" ? error.message : null,
    };
  }
};

const registerAcmeAccount = async (email) => {
  if (!email) {
     throw new Error("E-mail é obrigatório para registrar a conta ACME.");
   }
  const command = buildCommand(
    SSL_CONFIG.registerCommand,
    [SSL_CONFIG.domain, ...SSL_CONFIG.altDomains],
    {
      accountEmail: email,
      email,
    }
  );
  try {
    const result = await runShellCommand("registro da conta SSL", command);
    return {
      command,
      ...result,
    };
  } catch (error) {
    if (error) {
      error.command = command;
    }
    throw error;
  }
};

const readCertificateInfo = async () => {
  try {
    await fsp.access(SSL_CONFIG.certPath, fs.constants.R_OK);
  } catch (error) {
