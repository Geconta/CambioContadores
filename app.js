// Variables globales
let loadedData = [];
let registros = [];
let currentPage = 1;
const rowsPerPage = 5;
let qrScanner = null;
let scannerActive = false;
let filaSeleccionada = null;
let indexSeleccionado = -1;

// Cargar registros guardados desde localStorage
const registrosGuardados = localStorage.getItem("ordenesGuardadas");
if (registrosGuardados) {
  registros = JSON.parse(registrosGuardados);
}

// Login
function login() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;

  if ((user === "admin" && pass === "admin123") || (user === "tecnico" && pass === "1234")) {
    document.getElementById("login").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
  } else {
    alert("Usuario o contraseña incorrectos");
  }
}

// Cargar archivo CSV o Excel
document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();

  if (file.name.endsWith(".csv")) {
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n").map(line => line.split(","));
      const headers = lines[0];
      loadedData = lines.slice(1).filter(row => row.length === headers.length).map(row => {
        let obj = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = row[i].trim();
        });
        return obj;
      });
      currentPage = 1;
      renderTable();
      renderPagination();
    };
    reader.readAsText(file);
  } else {
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      loadedData = XLSX.utils.sheet_to_json(sheet);
      currentPage = 1;
      renderTable();
      renderPagination();
    };
    reader.readAsArrayBuffer(file);
  }
});

// Renderizar tabla
function renderTable() {
  const div = document.getElementById("dataPreview");
  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageData = loadedData.slice(start, end);

  if (pageData.length === 0) {
    div.innerHTML = "<p class='text-gray-500'>No hay datos.</p>";
    return;
  }

  let html = "<table class='table-auto w-full border'><thead><tr>";
  Object.keys(pageData[0]).forEach(k => {
    html += `<th class='border p-1'>${k}</th>`;
  });
  html += "<th class='border p-1'>Acción</th></tr></thead><tbody>";

  pageData.forEach((row, idx) => {
    const absoluteIndex = start + idx;
    const selectedClass = (absoluteIndex === indexSeleccionado) ? 'bg-yellow-100' : '';
    html += `<tr class="${selectedClass}">`;
    Object.values(row).forEach(val => {
      html += `<td class='border p-1'>${val}</td>`;
    });
    html += `<td class='border p-1'><button class='bg-blue-500 text-white px-2 py-1 rounded text-xs' onclick='seleccionarFila(${absoluteIndex})'>Seleccionar</button></td>`;
    html += "</tr>";
  });

  html += "</tbody></table>";
  div.innerHTML = html;
}

// Renderizar paginación
function renderPagination() {
  const pagination = document.getElementById("pagination");
  const totalPages = Math.ceil(loadedData.length / rowsPerPage);
  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = `px-2 py-1 rounded ${i === currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200'}`;
    btn.onclick = () => {
      currentPage = i;
      renderTable();
      renderPagination();
    };
    pagination.appendChild(btn);
  }
}

// Seleccionar fila
function seleccionarFila(index) {
  filaSeleccionada = loadedData[index];
  indexSeleccionado = index;
  alert("Fila seleccionada correctamente.");
  renderTable();
}

// Mostrar formulario de orden
function mostrarSeccionOrden() {
  if (!filaSeleccionada) {
    alert("Primero selecciona una fila antes de agregar una orden.");
    return;
  }

  document.getElementById("app").classList.add("hidden");
  document.getElementById("orden").classList.remove("hidden");

  const contenedor = document.getElementById("filaSeleccionadaPreview");
  let html = `<div class="bg-white border rounded p-3 mb-4"><h3 class="font-bold mb-2">Datos Seleccionados:</h3><ul class="list-disc pl-4">`;

  for (let key in filaSeleccionada) {
    html += `<li><strong>${key}:</strong> ${filaSeleccionada[key]}</li>`;
  }

  html += "</ul></div>";
  contenedor.innerHTML = html;
}

// Guardar nueva orden
document.getElementById("newCounterForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const lecturaInicial = document.getElementById("lecturaAntigua").value;
  const contadorNuevo = document.getElementById("newCounter").value;
  const emisorNuevo = document.getElementById("radioModule").value;
  const lecturaFinal = document.getElementById("lecturaNueva").value;

  const registroFinal = {
    original: { ...filaSeleccionada },
    nuevos: {
      lecturaInicial,
      contadorNuevo,
      emisorNuevo,
      lecturaFinal
    }
  };

  registros.push(registroFinal);
  localStorage.setItem("ordenesGuardadas", JSON.stringify(registros));
  alert("Orden guardada satisfactoriamente.");
  e.target.reset();
  indexSeleccionado = -1;
  filaSeleccionada = null;

  document.getElementById("orden").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  renderTable();
  renderPagination();
});

// Función para aplanar un registro
function aplanarRegistro(registro) {
  const nombresBonitos = {
    lecturaInicial: "Lectura Inicial",
    contadorNuevo: "Número de Serie Contador Nuevo",
    emisorNuevo: "Número de Serie Emisor Nuevo",
    lecturaFinal: "Lectura Final"
  };

  const plano = {};

  // Aplanar datos originales
  for (let key in registro.original) {
    plano[`Original - ${key}`] = registro.original[key];
  }

  // Aplanar datos nuevos
  for (let key in registro.nuevos) {
    const nombre = nombresBonitos[key] || key;
    plano[`Nuevo - ${nombre}`] = registro.nuevos[key];
  }

  return plano;
}

// Exportar a Excel
function exportToExcel() {
  if (registros.length === 0) return alert("No hay registros para exportar.");

  // Crear array para todas las filas
  const excelData = [];

  // Por cada registro, crear una fila con toda la información
  registros.forEach((registro, index) => {
    const fila = {
      'Nº Orden': index + 1
    };

    // Agregar datos originales
    for (let key in registro.original) {
      fila[`Original - ${key}`] = registro.original[key];
    }

    // Agregar datos nuevos con nombres más descriptivos
    const nombresBonitos = {
      lecturaInicial: "Lectura Inicial",
      contadorNuevo: "Número de Serie Contador Nuevo",
      emisorNuevo: "Número de Serie Emisor Nuevo",
      lecturaFinal: "Lectura Final"
    };

    for (let key in registro.nuevos) {
      const nombre = nombresBonitos[key] || key;
      fila[`Nuevo - ${nombre}`] = registro.nuevos[key];
    }

    excelData.push(fila);
  });

  // Crear la hoja de Excel
  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registros");

  // Ajustar el ancho de las columnas
  const columnWidths = {};
  excelData.forEach(row => {
    for (let key in row) {
      const length = Math.max(key.length, String(row[key]).length);
      columnWidths[key] = Math.max(columnWidths[key] || 0, length);
    }
  });

  ws['!cols'] = Object.keys(columnWidths).map(key => ({
    wch: columnWidths[key] + 2
  }));

  // Guardar el archivo
  XLSX.writeFile(wb, "registros_contadores.xlsx");
}

// Exportar a CSV
function exportToCSV() {
  if (registros.length === 0) return alert("No hay registros para exportar.");

  const registrosAplanados = registros.map(aplanarRegistro);
  const headers = Object.keys(registrosAplanados[0]);
  const csvRows = [headers.join(",")];

  registrosAplanados.forEach(row => {
    const values = headers.map(header => `"${row[header] || ""}"`);
    csvRows.push(values.join(","));
  });

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "registros_contadores.csv";
  a.click();
  URL.revokeObjectURL(url);
}


// Activar o desactivar escáner QR
function toggleScanner(targetInputId) {
  const readerElement = document.getElementById("reader");
  const existingHelpText = document.querySelector('.scanner-help-text');

  if (scannerActive) {
    qrScanner.stop().then(() => {
      scannerActive = false;
      readerElement.classList.add("hidden");
      if (existingHelpText) existingHelpText.remove();
    });
  } else {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        const backCamera = devices.find(device => device.label.toLowerCase().includes("back")) || devices[0];

        qrScanner = new Html5Qrcode("reader");
        readerElement.classList.remove("hidden");

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        };

        // Mensaje de ayuda
        if (existingHelpText) existingHelpText.remove();
        const helpText = document.createElement('p');
        helpText.className = 'text-center text-sm mt-2 text-gray-600 scanner-help-text';
        helpText.innerHTML = `
          <strong>Consejos para QR:</strong><br>
          - Centra el código en el cuadro<br>
          - Mantén la cámara estable
        `;
        
        readerElement.parentNode.insertBefore(helpText, readerElement.nextSibling);

        qrScanner.start(
          backCamera.id,
          config,
          (decodedText) => {
            if (targetInputId === "newCounter" && decodedText.includes(';')) {
              decodedText = decodedText.split(';')[1].slice(0, -4);
            } else if (targetInputId === "radioModule") {
              decodedText = decodedText.substring(1, 13);
            }
            
            document.getElementById(targetInputId).value = decodedText;
            alert("¡Código leído correctamente!");

            setTimeout(() => {
              qrScanner.stop().then(() => {
                scannerActive = false;
                readerElement.classList.add("hidden");
                if (existingHelpText) existingHelpText.remove();
              });
            }, 500);
          },
          (errorMessage) => {
            console.log("Error al escanear:", errorMessage);
          }
        );

        scannerActive = true;

      } else {
        alert("No se detectaron cámaras disponibles");
      }
    }).catch(err => {
      console.error("Error al acceder a la cámara:", err);
      alert("Error al acceder a la cámara: " + err);
    });
  }
}


// Mostrar lista de órdenes guardadas
// Mostrar lista de órdenes guardadas
function mostrarListaOrdenes() {
  const contenedor = document.getElementById("contenedorOrdenes");

  if (registros.length === 0) {
    contenedor.innerHTML = "<p class='text-gray-500'>No hay órdenes guardadas.</p>";
  } else {
    let html = "<div class='grid gap-4 sm:grid-cols-1 md:grid-cols-2'>";

    // Diccionario de nombres legibles
    const nombresBonitos = {
      lecturaInicial: "Lectura Inicial",
      contadorNuevo: "Número de Serie Contador Nuevo",
      emisorNuevo: "Número de Serie Emisor Nuevo",
      lecturaFinal: "Lectura Final"
    };

    registros.forEach((orden, index) => {
      html += `
        <div class="border rounded-2xl p-4 bg-white shadow hover:shadow-lg transition duration-300">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-semibold text-blue-700">📝 Orden #${index + 1}</h3>
            <button onclick="eliminarRegistro(${index})" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition">Eliminar</button>
          </div>

          <div class="text-sm mb-2">
            <p class="font-medium text-gray-700 mb-1">🔹 Datos Originales:</p>
            <ul class="list-disc list-inside text-gray-600 ml-2">
              ${Object.entries(orden.original).map(([key, val]) => `<li><strong>${key}:</strong> ${val}</li>`).join("")}
            </ul>
          </div>

          <div class="text-sm">
            <p class="font-medium text-gray-700 mb-1">🆕 Datos Nuevos:</p>
            <ul class="list-disc list-inside text-gray-600 ml-2">
              ${Object.entries(orden.nuevos).map(([key, val]) => {
                const nombreBonito = nombresBonitos[key] || key;
                return `<li><strong>${nombreBonito}:</strong> ${val}</li>`;
              }).join("")}
            </ul>
          </div>
        </div>
      `;
    });

    html += "</div>";
    contenedor.innerHTML = html;
  }

  document.getElementById("app").classList.add("hidden");
  document.getElementById("orden").classList.add("hidden");
  document.getElementById("listaOrdenes").classList.remove("hidden");
}


// Eliminar registro individual
function eliminarRegistro(index) {
  if (confirm("¿Estás seguro que deseas eliminar este registro?")) {
    registros.splice(index, 1);
    localStorage.setItem("ordenesGuardadas", JSON.stringify(registros));
    mostrarListaOrdenes();
  }
}

// Volver al menú principal
function volverAlMenu() {
  document.getElementById("listaOrdenes").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

// Vaciar todos los registros
function vaciarRegistros() {
  if (confirm("¿Deseas eliminar todos los registros?")) {
    if (confirm("Recuerda que esta acción eliminará todos los registros. ¿Estás seguro?")) {
      registros = [];
      localStorage.removeItem("ordenesGuardadas");
      alert("Registros vaciados correctamente.");
      mostrarListaOrdenes();
    }
  }
}
function llenarSelectsDeOrden() {
  if (!filaSeleccionada) return;

  const keys = Object.keys(filaSeleccionada);

  const selects = [
    "fieldCounter",
    "fieldRadio",
    "fieldLecturaAntigua",
    "fieldLecturaNueva"
  ];

  selects.forEach(id => {
    const select = document.getElementById(id);
    select.innerHTML = ""; // Limpiar opciones anteriores

    keys.forEach(k => {
      const option = document.createElement("option");
      option.value = k;
      option.textContent = k;
      select.appendChild(option);
    });
  });
}

function mostrarSeccionOrden() {
  if (!filaSeleccionada) {
    alert("Primero selecciona una fila antes de agregar una orden.");
    return;
  }

  document.getElementById("app").classList.add("hidden");
  document.getElementById("orden").classList.remove("hidden");

  const contenedor = document.getElementById("filaSeleccionadaPreview");
  let html = `<div class="bg-white border rounded p-3 mb-4"><h3 class="font-bold mb-2">Datos Seleccionados:</h3><ul class="list-disc pl-4">`;

  for (let key in filaSeleccionada) {
    html += `<li><strong>${key}:</strong> ${filaSeleccionada[key]}</li>`;
  }

  html += "</ul></div>";
  contenedor.innerHTML = html;

  // 👇 AÑADIDO PARA LLENAR LOS SELECTS
  llenarSelectsDeOrden();
}

