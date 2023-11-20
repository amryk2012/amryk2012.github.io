// Load the Google Drive API and Sheets API
gapi.load('client', initClient);

// Variables to keep track of the loaded files, current index, and ratings
let nextPageToken = null;
let loadedFiles = [];
let currentAudioIndex = 0;
let ratings = [];
let sheetId; // Variable to store the Google Sheet ID
let clientId; // Variable to store the OAuth2 client ID

function initGoogleSignIn() {
  gapi.load('auth2', () => {
    gapi.auth2.init({
      client_id: '780585253919-4pvvj2snurhfrhfl9om4spac9glqv378.apps.googleusercontent.com',
      scope: 'profile email',
    }).then(() => {
      // Sign-in is successful, proceed with your application logic
      console.log('Google Sign-In initialized successfully');
      initClient(); // Initialize other functionality after successful sign-in
    });
  });
}

function onGoogleSignIn(googleUser) {
  const profile = googleUser.getBasicProfile();
  console.log('Logged in as: ' + profile.getName());
  // Add your logic for handling the signed-in user
}

// Load the Google Drive API and Sheets API
function initClient() {
  console.log('Initializing client...');
  // Load the configuration from the JSON file
  fetch('config.json')
    .then(response => {
      console.log('Fetch response:', response);
      if (!response.ok) {
        throw new Error(`Failed to load config.json: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(config => {
      console.log('Loaded configuration:', config);
      // Set the sheetId, clientId, and scope from the config
      sheetId = config.sheetId;
      clientId = config.clientId;
      const scope = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets';

      // Initialize the Google Drive API client with the loaded configuration
      return gapi.client.init({
        clientId: clientId,
        apiKey: config.apiKey,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest", "https://sheets.googleapis.com/$discovery/rest?version=v4"],
        scope: scope,
      });
    })
    .then(() => {
      console.log('Initialization successful');
      // Call your functions here
      loadAudioFiles(config.driveFolderId);
    })
    .catch(error => {
      console.error('Error loading config:', error);
      console.error(error.stack); // Log the full stack trace for debugging
    });
}


function loadAudioFiles(folderId) {
  // Use the Google Drive API to list files in the specified folder
  gapi.client.drive.files.list({
    q: `'${folderId}' in parents`,
    fields: "nextPageToken, files(id, name)",
    orderBy: "name",
    pageSize: 100,
    pageToken: nextPageToken,
  }).then(response => {
    const audioList = document.getElementById('audioList');
    const loadingStatus = document.getElementById('loadingStatus');

    loadedFiles = loadedFiles.concat(response.result.files);

    audioList.innerHTML = '';

    loadedFiles.forEach((file, index) => {
      const option = document.createElement('option');
      option.value = file.id;
      option.text = file.name;
      audioList.add(option);
    });

    loadingStatus.textContent = `Loaded ${loadedFiles.length} audio files.`;

    nextPageToken = response.result.nextPageToken;

    updateCurrentAudioNumber();
    loadRatingsFromSheet(); // Load ratings from the Google Sheet
  })
  .catch(error => console.error('Error loading audio files:', error));
}

function loadRatingsFromSheet() {
  gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: sheetId, // Use the sheetId from the config
    range: 'A:B',
  }).then(response => {
    const values = response.result.values;

    if (values) {
      ratings = values.map(row => ({
        name: row[0],
        rating: row[1],
      }));

      // Update the rating textbox
      updateRatingTextBox();
    }
  })
  .catch(error => console.error('Error loading ratings from sheet:', error));
}

function updateRatingTextBox() {
  const audioList = document.getElementById('audioList');
  const ratingTextBox = document.getElementById('ratingTextBox');

  const selectedAudio = loadedFiles[audioList.selectedIndex];
  const matchingRating = ratings.find(rating => rating.name === selectedAudio.name);

  if (matchingRating) {
    ratingTextBox.value = matchingRating.rating;
  } else {
    ratingTextBox.value = ''; // No rating found, clear the textbox
  }
}

function playSelectedAudio() {
  const audioList = document.getElementById('audioList');
  const selectedAudioId = audioList.value;
  const audioPlayer = document.getElementById('audioPlayer');

  audioPlayer.src = `https://drive.google.com/uc?id=${selectedAudioId}`;
  audioPlayer.play();

  currentAudioIndex = audioList.selectedIndex;
  updateCurrentAudioNumber();
  updateRatingTextBox();
}

function onRatingChange() {
  const saveButton = document.getElementById('saveButton');
  saveButton.style.display = 'block'; // Show the save button when the rating changes
}

function saveRating() {
  const audioList = document.getElementById('audioList');
  const ratingTextBox = document.getElementById('ratingTextBox');

  const selectedAudio = loadedFiles[audioList.selectedIndex];
  const existingRatingIndex = ratings.findIndex(rating => rating.name === selectedAudio.name);

  if (existingRatingIndex !== -1) {
    ratings[existingRatingIndex].rating = ratingTextBox.value;
  } else {
    ratings.push({
      name: selectedAudio.name,
      rating: ratingTextBox.value,
    });
  }

  // Update the Google Sheet with the new ratings
  gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: sheetId, // Use the sheetId from the config
    range: 'A:B',
    valueInputOption: 'RAW',
    resource: {
      values: ratings.map(rating => [rating.name, rating.rating]),
    },
  }).then(() => {
    console.log('Rating saved successfully');
    document.getElementById('saveButton').style.display = 'none'; // Hide the save button after saving
  })
  .catch(error => console.error('Error saving rating:', error));
}

function updateCurrentAudioNumber() {
  const currentAudioNumber = document.getElementById('currentAudioNumber');
  const audioList = document.getElementById('audioList');

  currentAudioNumber.textContent = `Currently selected audio: ${currentAudioIndex + 1}`;
}

// Initialize Google Sign-In
initGoogleSignIn();
