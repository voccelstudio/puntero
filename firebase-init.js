/**
 * Firebase Init - Puntero ERP
 * Inicializa Firebase con las credenciales del proyecto.
 * Expone _FIRESTORE, _AUTH y _STORAGE como globales.
 */
(function () {
  var config = {
    apiKey: "AIzaSyA4NCkpQ_rgu8LnkfiSBysOzfu6l3f2Hwo",
    authDomain: "puntero-46d12.firebaseapp.com",
    projectId: "puntero-46d12",
    storageBucket: "puntero-46d12.firebasestorage.app",
    messagingSenderId: "458821594462",
    appId: "1:458821594462:web:8d5f5fa88129e28e03b3cf",
    measurementId: "G-MEH1S78FXZ"
  };

  firebase.initializeApp(config);
  // La config NO es secreta (va en todo cliente web y las reglas de seguridad
  // son las que protegen): se expone para que el admin pueda crear una segunda
  // instancia de Auth (ver _authSecundaria en app.js) sin pisar su sesión.
  window._FB_CONFIG = config;
  window._FIRESTORE = firebase.firestore();
  window._AUTH = firebase.auth();
  window._STORAGE = firebase.storage();
})();
