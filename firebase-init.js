/**
 * Firebase Init - Puntero ERP
 * Inicializa Firebase con las credenciales del proyecto.
 * Expone _FIRESTORE, _AUTH y _STORAGE como globales.
 */
(function () {
  var config = {
    apiKey: "AIzaSyBRiqcAtJ62YPmrQ2-UsYJNbZdMrZOMuF0",
    authDomain: "puntero-d6f96.firebaseapp.com",
    projectId: "puntero-d6f96",
    storageBucket: "puntero-d6f96.firebasestorage.app",
    messagingSenderId: "516017364294",
    appId: "1:516017364294:web:38ad22ae0075f7e0bf1947",
    measurementId: "G-MR2PK672L3"
  };

  firebase.initializeApp(config);
  window._FIRESTORE = firebase.firestore();
  window._AUTH = firebase.auth();
  window._STORAGE = firebase.storage();
})();
