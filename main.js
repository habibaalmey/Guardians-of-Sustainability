import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

import Base64 from 'base64-js';

import MarkdownIt from 'markdown-it';

import { maybeShowApiKeyBanner } from './gemini-api-banner';

import ExifReader from 'exifreader'; // Import ExifReader for metadata extraction



// 🔥 Add your API key here

let API_KEY = 'AIzaSyBJoutVJrUn7wtBmZe_v9lXZcfE43SYNBo';

let form = document.querySelector('form');

let promptInput = document.querySelector('input[name="prompt"]');

let output = document.querySelector('.output');



let map = null; // Single map instance

let markers = []; // Store markers to clear/update them

initializeMap();



form.onsubmit = async (ev) => {

  ev.preventDefault();

  output.innerHTML = ''; // Clear previous output

  output.textContent = 'Generating...';



  try {

    const fileInput = document.getElementById('fileInput');

    const files = fileInput.files;



    if (files.length === 0) {

      output.textContent = 'Please select at least one image.';

      return;

    }



    let results = [];



    for (let file of files) {

      const imageBase64 = await convertImageToBase64(file);

      const gpsData = await getGpsData(file);



      let contents = [

        {

          role: 'user',

          parts: [

            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },

            { text: promptInput.value }

          ]

        }

      ];



      const genAI = new GoogleGenerativeAI(API_KEY);

      const model = genAI.getGenerativeModel({

        model: "gemini-1.5-flash",

        safetySettings: [

          {

            category: HarmCategory.HARM_CATEGORY_HARASSMENT,

            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH

          },

        ],

      });



      const result = await model.generateContentStream({ contents });



      let buffer = [];

      let md = new MarkdownIt();



      for await (let response of result.stream) {

        buffer.push(response.text());

      }



      results.push({ fullReport: buffer.join(''), gpsData });

    }



    output.innerHTML = ''; // Clear initial loading text



    if (!map) {

      initializeMap();

    }



    updateMapMarkers(results);

  } catch (e) {

    output.innerHTML = '<hr>' + e;

  }

};



async function convertImageToBase64(file) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onload = () => resolve(reader.result.split(',')[1]);

    reader.onerror = reject;

  });

}



async function getGpsData(file) {

  try {

    const tags = await ExifReader.load(file);

    if (tags['GPSLatitude'] && tags['GPSLongitude']) {

      return {

        latitude: tags['GPSLatitude'].description,

        longitude: tags['GPSLongitude'].description

      };

    }

    return null;

  } catch (error) {

    console.error('Error extracting GPS data:', error);

    return null;

  }

}



function initializeMap() {

  map = L.map('map').setView([0, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {

    attribution: '&copy; OpenStreetMap contributors'

  }).addTo(map);



  // Adding a legend for marker colors

  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function () {

    let div = L.DomUtil.create('div', 'legend');

    // Styling the legend container

    div.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';

    div.style.padding = '10px';

    div.style.borderRadius = '5px';

    div.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.2)';

    div.style.color = 'black'; // Ensure all text is black



    // Using a structured layout to organize the legend items with black text

    div.innerHTML = `

      <h4 style="margin: 0 0 5px; color: black;">Priority Levels</h4>

      <div style="display: flex; align-items: center; margin-bottom: 5px;">

        <div style="background: red; width: 20px; height: 20px; margin-right: 8px;"></div>

        <span style="color: black;">High Priority</span>

      </div>

      <div style="display: flex; align-items: center; margin-bottom: 5px;">

        <div style="background: orange; width: 20px; height: 20px; margin-right: 8px;"></div>

        <span style="color: black;">Medium Priority</span>

      </div>

      <div style="display: flex; align-items: center; margin-bottom: 5px;">

        <div style="background: yellow; width: 20px; height: 20px; margin-right: 8px;"></div>

        <span style="color: black;">Low Priority</span>

      </div>

      <div style="display: flex; align-items: center;">

        <div style="background: green; width: 20px; height: 20px; margin-right: 8px;"></div>

        <span style="color: black;">No Priority</span>

      </div>

    `;

    return div;

  };

  legend.addTo(map);

}





function updateMapMarkers(results) {

  markers.forEach(marker => map.removeLayer(marker));

  markers = [];



  let bounds = L.latLngBounds();



  results.forEach((result, index) => {

    let reportElement = document.createElement('p');

    reportElement.innerHTML = `<strong>Image ${index + 1} Report:</strong> ${result.fullReport}`;



    output.appendChild(reportElement);



    if (result.gpsData) {

      const { latitude, longitude } = result.gpsData;

      const markerColor = getMarkerColor(result.fullReport);



      const customIcon = L.divIcon({

        className: 'custom-marker',

        html: `<div style="background-color: ${markerColor}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,

        iconSize: [20, 20],

        iconAnchor: [10, 10],

      });



      const marker = L.marker([latitude, longitude], { icon: customIcon })

        .addTo(map)

        .bindPopup(`Image ${index + 1}`)

        .openPopup();



      markers.push(marker);

      bounds.extend([latitude, longitude]);



      const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

      let mapLink = document.createElement('p');

      mapLink.innerHTML = `🗺 GPS Location: <a href="${googleMapsLink}" target="_blank" style="color: white;">View on Google Maps</a>`;



      output.appendChild(mapLink);

    } else {

      let noGps = document.createElement('p');

      noGps.textContent = 'GPS Location not available.';

      output.appendChild(noGps);

    }



    // Add extra space between reports

    let spacer = document.createElement('div');

    spacer.style.height = '30px';

    output.appendChild(spacer);



    output.appendChild(document.createElement('hr'));

  });



  if (markers.length > 0) {

    map.fitBounds(bounds);

  }

}



function getMarkerColor(reportText) {

  const lowerText = reportText.toLowerCase();

  if (lowerText.includes('priority level: high')) return 'red';

  if (lowerText.includes('priority level: medium')) return 'orange';

  if (lowerText.includes('priority level: low')) return 'yellow';

  if (lowerText.includes('priority level: no')) return 'green';

  return 'blue'; // Default if no matching phrase is found

}



maybeShowApiKeyBanner(API_KEY);
