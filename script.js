// === GLOBAL STATE ===
let map;
let userMarker;
let directionsService;
let directionsRenderer;

// "Memoria" simple del usuario
const userModel = {
  language: navigator.language || "en-US", // auto según dispositivo
  favoriteCuisines: new Set(),
  feedbackHistory: [],
};

// === GOOGLE MAP INITIALIZATION ===
function initMap() {
  const tampa = { lat: 27.9506, lng: -82.4572 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: tampa,
    zoom: 11,
    disableDefaultUI: false,
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ map });

  // Try to center on user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        map.setCenter(loc);
        map.setZoom(13);
        userMarker = new google.maps.Marker({
          position: loc,
          map,
          title: "Your position",
        });
      },
      () => {
        // If denied, keep Tampa
      }
    );
  }

  setupVoice();
  speakFormal(
    "OptiRoute AI is ready. Press the voice button and say your destination."
  );
}

// === SPEECH SYNTHESIS (COPILOT FORMAL) ===
function speakFormal(text) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = userModel.language.startsWith("es") ? "es-ES" : "en-US";
  utter.rate = 1;
  synth.cancel();
  synth.speak(utter);
}

// === VOICE RECOGNITION SETUP ===
let recognition;
let isListening = false;

function setupVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceBtn = document.getElementById("voice-btn");
  const statusEl = document.getElementById("voice-status");

  if (!SpeechRecognition) {
    statusEl.textContent =
      "Voice control is not supported in this browser. Try Chrome or Edge.";
    voiceBtn.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = userModel.language; // auto: es-ES, en-US, etc.
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    voiceBtn.classList.add("listening");
    statusEl.textContent =
      userModel.language.startsWith("es")
        ? "Escuchando... habla ahora."
        : "Listening... please speak.";
  };

  recognition.onend = () => {
    isListening = false;
    voiceBtn.classList.remove("listening");
    statusEl.textContent =
      userModel.language.startsWith("es")
        ? "Pulsa el botón y pide una ruta, gasolinera o restaurante."
        : "Tap the button and request a route, gas station, or restaurant.";
  };

  recognition.onerror = () => {
    isListening = false;
    voiceBtn.classList.remove("listening");
    statusEl.textContent =
      "There was an issue with voice recognition. Try again.";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    handleVoiceCommand(transcript);
  };

  voiceBtn.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

// === VOICE COMMAND HANDLER ===
function handleVoiceCommand(text) {
  const output = document.getElementById("copilot-output");
  output.textContent = `You said: "${text}"`;

  // Normalize spaces
  const clean = text.trim().toLowerCase();

  // --- COMMAND: CHEAP GAS ---
  if (
    clean.includes("gasolinera") ||
    clean.includes("cheapest gas") ||
    clean.includes("cheap gas") ||
    clean.includes("gas station")
  ) {
    speakFormal(
      userModel.language.startsWith("es")
        ? "Buscando gasolineras económicas cerca de ti."
        : "Searching for cheap gas stations near you."
    );
    findCheapGasStations();
    return;
  }

  // --- COMMAND: RESTAURANTS ---
  if (
    clean.includes("restaurante") ||
    clean.includes("restaurant") ||
    clean.includes("food") ||
    clean.includes("comida")
  ) {
    const cuisine = extractCuisine(clean);
    if (cuisine) userModel.favoriteCuisines.add(cuisine);

    speakFormal(
      userModel.language.startsWith("es")
        ? `Buscando restaurantes de ${cuisine || "tu preferencia"} cerca de ti.`
        : `Looking for ${cuisine || "recommended"} restaurants near you.`
    );
    suggestRestaurants(cuisine);
    return;
  }

  // --- COMMAND: TAKE ME TO... ---
  if (
    clean.startsWith("llévame a ") ||
    clean.startsWith("llevame a ") ||
    clean.startsWith("take me to ")
  ) {
    let destination = clean
      .replace("llévame a", "")
      .replace("llevame a", "")
      .replace("take me to", "")
      .trim();
    if (!destination) {
      speakFormal(
        userModel.language.startsWith("es")
          ? "No entendí el destino. Intenta decir, por ejemplo, llévame a Costco."
          : "I didn't catch the destination. Try saying, for example, take me to Costco."
      );
      return;
    }
    routeToDestination(destination);
    return;
  }

  // --- DEFAULT HELP ---
  speakFormal(
    userModel.language.startsWith("es")
      ? "No he entendido el comando. Puedes decir: llévame a Target, busca gasolinera barata, o busca restaurante de tacos."
      : "I did not understand that command. You can say: take me to Walmart, find cheap gas, or find a pizza restaurant."
  );
}

// === SIMPLE "AI" TO DETECT TYPE OF FOOD ===
function extractCuisine(text) {
  const cuisines = [
    "pizza",
    "tacos",
    "burger",
    "burgers",
    "sushi",
    "italian",
    "mexican",
    "chinese",
    "coffee",
    "cafetería",
    "tacos",
    "hamburguesas",
    "mexicana",
  ];

  for (const c of cuisines) {
    if (text.includes(c)) return c;
  }
  return null;
}

// === ROUTING TO A DESTINATION (USING GEOCODING + DIRECTIONS) ===
function routeToDestination(destinationName) {
  const output = document.getElementById("copilot-output");

  // Use Geocoding API via directionsService with "text" destination
  if (!map) return;

  // If we have userMarker, start from there, else from map center
  const origin =
    userMarker && userMarker.getPosition
      ? userMarker.getPosition()
      : map.getCenter();

  const request = {
    origin,
    destination: destinationName,
    travelMode: google.maps.TravelMode.DRIVING,
  };

  directionsService.route(request, (result, status) => {
    if (status === google.maps.DirectionsStatus.OK) {
      directionsRenderer.setDirections(result);
      const leg = result.routes[0].legs[0];

      output.textContent = `Routing to ${leg.end_address} (${Math.round(
        leg.distance.value / 1000
      )} km, ${leg.duration.text}).`;

      speakFormal(
        userModel.language.startsWith("es")
          ? `He trazado una ruta hacia ${leg.end_address}. Duración aproximada ${leg.duration.text}.`
          : `I have drawn a route to ${leg.end_address}. Estimated duration ${leg.duration.text}.`
      );

      // after route, ask feedback when user clicks somewhere later
      setTimeout(askForTripFeedback, 5000);
    } else {
      output.textContent = "Could not calculate route.";
      speakFormal(
        userModel.language.startsWith("es")
          ? "No he podido calcular la ruta. Intenta con otro destino."
          : "I couldn't calculate the route. Try another destination."
      );
    }
  });
}

// === CHEAP GAS STATIONS (SIMULATED STRUCTURE) ===
function findCheapGasStations() {
  const center = map.getCenter();
  if (!center) return;

  // For the assignment, we simulate gas stations around the user.
  // In a real app, aquí llamarías a un API externo (por ej. GasBuddy).
  const gasStations = [
    {
      name: "EcoFuel Station",
      price: 3.19,
      offsetLat: 0.01,
      offsetLng: 0.008,
    },
    {
      name: "Budget Gas",
      price: 3.09,
      offsetLat: -0.007,
      offsetLng: 0.006,
    },
    {
      name: "SpeedWay Express",
      price: 3.29,
      offsetLat: 0.005,
      offsetLng: -0.009,
    },
  ];

  let cheapest = gasStations[0];
  gasStations.forEach((g) => {
    if (g.price < cheapest.price) cheapest = g;

    const pos = {
      lat: center.lat() + g.offsetLat,
      lng: center.lng() + g.offsetLng,
    };
    new google.maps.Marker({
      position: pos,
      map,
      label: { text: `$${g.price.toFixed(2)}`, color: "#ffffff" },
      title: `${g.name} - $${g.price.toFixed(2)}/gal`,
    });
  });

  const output = document.getElementById("copilot-output");
  output.textContent = `Cheapest nearby: ${cheapest.name} - $${cheapest.price.toFixed(
    2
  )} per gallon (simulated data).`;

  speakFormal(
    userModel.language.startsWith("es")
      ? `La gasolinera más económica que encontré es ${cheapest.name}, con un precio aproximado de ${cheapest.price.toFixed(
          2
        )} dólares por galón.`
      : `The cheapest gas station I found is ${cheapest.name}, around $${cheapest.price.toFixed(
          2
        )} per gallon.`
  );
}

// === RESTAURANT SUGGESTIONS (SIMULATED MARKERS) ===
function suggestRestaurants(cuisine) {
  const center = map.getCenter();
  if (!center) return;

  const type = cuisine || "recommended";

  const restaurants = [
    {
      name:
        cuisine === "tacos"
          ? "Taco Route Cantina"
          : cuisine === "pizza"
          ? "OptiRoute Pizza Hub"
          : "OptiRoute Bistro",
      offsetLat: 0.004,
      offsetLng: 0.006,
    },
    {
      name:
        cuisine === "coffee"
          ? "FuelUp Coffee"
          : "Driver's Diner",
      offsetLat: -0.005,
      offsetLng: 0.004,
    },
  ];

  restaurants.forEach((r) => {
    const pos = {
      lat: center.lat() + r.offsetLat,
      lng: center.lng() + r.offsetLng,
    };
    new google.maps.Marker({
      position: pos,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: "#ffcc00",
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: "#333",
      },
      title: r.name,
    });
  });

  const output = document.getElementById("copilot-output");
  output.textContent = `Suggested ${type} places near you (simulated markers).`;

  speakFormal(
    userModel.language.startsWith("es")
      ? `He marcado en el mapa algunos lugares recomendados de ${
          cuisine || "comida"
        } cerca de ti.`
      : `I highlighted some recommended ${type} places near you on the map.`
  );
}

// === FEEDBACK AFTER TRIP ===
function askForTripFeedback() {
  const feedbackText = userModel.language.startsWith("es")
    ? "¿Cómo estuvo este viaje? Puedes decir: excelente, bien o malo."
    : "How was this trip? You can say: excellent, okay, or bad.";

  speakFormal(feedbackText);

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  const feedbackRecognition = new SpeechRecognition();
  feedbackRecognition.lang = userModel.language;
  feedbackRecognition.continuous = false;
  feedbackRecognition.interimResults = false;

  feedbackRecognition.onresult = (event) => {
    const result = event.results[0][0].transcript.toLowerCase();
    handleFeedbackResult(result);
  };

  feedbackRecognition.start();
}

function handleFeedbackResult(text) {
  const log = document.getElementById("feedback-log");
  userModel.feedbackHistory.push(text);

  const line = document.createElement("div");
  line.textContent = `Trip feedback: "${text}"`;
  log.prepend(line);

  speakFormal(
    userModel.language.startsWith("es")
      ? "Gracias por tu feedback. Lo usaré para mejorar tus próximas recomendaciones."
      : "Thank you for your feedback. I will use it to improve your next suggestions."
  );
}