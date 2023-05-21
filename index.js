const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const express = require('express');
require('dotenv').config();
const PORT = 3000 || process.env.PORT;
const app = express();
// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.file',
'https://www.googleapis.com/auth/spreadsheets'
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function listMajors(auth) {
  const sheets = google.sheets({version: 'v4', auth});
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '1cQMyFONdsn1rTtW-wV79HjETbyiiNrAcv6dqnY8lf08',
    range: 'Products',
  });

  const rows = res.data.values;
 
  if (!rows || rows.length === 0) {
    return [];
  }
 
  // Convert rows to JSON
  const headers = rows[0];
  const jsonData = rows.slice(1).map((row) =>
    headers.reduce((obj, header, index) => {
        obj[header] = row[index];
      return obj;
    }, {})
  );
// Assuming jsonData is already defined
// Iterate over each object in jsonData and modify the "images" property
jsonData.forEach((obj) => {
  if (obj.images) {
    const imageArray = obj.images.split(",").map((url) => url.trim());
    obj.images = imageArray;
  }
});
// Return the modified jsonData
return jsonData
}

// Route to handle the homepage
app.get('/products', (req, res) => {
  authorize()
    .then(listMajors)
    .then((jsonData) => {
      res.json(jsonData);
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Internal Server Error');
    });
});
// Route to handle the product details
app.get('/products/:id', (req, res) => {
  const id = req.params.id;
  authorize()
    .then((auth) => listMajors(auth))
    .then((jsonData) => {
      const product = jsonData.find((item) => item.id == id);
      if (product) {
        // Render the product template and pass the product data
        res.json( product );
      } else {
        // If product with specified ID is not found, render a 404 page
        res.status(404).send('Product not found');
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Internal Server Error');
    });
});


// Route to handle the category details
app.get('/products/category/:id', (req, res) => {
  const id = req.params.id;
  authorize()
    .then((auth) => listMajors(auth))
    .then((jsonData) => {
      const productsByCate = jsonData.filter((item) => item.category === id);
      if (productsByCate.length > 0) {
        // Render the product template and pass the products data
        res.json(productsByCate);
      } else {
        // If no products with specified category ID are found, render a 404 page
        res.status(404).send('Category not found');
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Internal Server Error');
    });
});


// Start the server
app.listen(PORT, () => {
  console.log('Server is running on PORT');
});