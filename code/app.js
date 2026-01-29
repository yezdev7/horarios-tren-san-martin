document.addEventListener('DOMContentLoaded', () => {
    
    // --- Referencias DOM ---
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    
    const screenHome = document.getElementById('screen-home');
    const screenResults = document.getElementById('screen-results');
    
    const btnSearch = document.getElementById('btn-search');
    const btnBack = document.getElementById('btn-back');
    const btnRefresh = document.getElementById('btn-refresh');
    
    const stationSelect = document.getElementById('station-select');
    const errorMsg = document.getElementById('error-msg');
    const displayStation = document.getElementById('display-station');
    
    const checkHoliday = document.getElementById('holiday-check');
    const checkIcon = document.querySelector('.checkbox-icon');

    // Referencias Relojes
    const clockTime1 = document.getElementById('clock-time-1');
    const clockDate1 = document.getElementById('clock-date-1');
    const clockTime2 = document.getElementById('clock-time-2');

    // Referencias Tarjetas
    const cardCabred = document.getElementById('card-cabred');
    const cardRetiro = document.getElementById('card-retiro');

    // --- VARIABLES DE DATOS ---
    let dbCabred = [];
    let dbRetiro = [];
    let estacionesOrdenadas = [];

    // --- 0. INICIALIZACIÓN Y CARGA DE DATOS ---
    async function init() {
        try {
            console.log("Iniciando carga de datos...");
            
            // INTENTA CARGAR LOS JSON
            // Ajusta la ruta si es necesario. Si usas Live Server, '../data/' sale de la carpeta code.
            const [resCabred, resRetiro] = await Promise.all([
                fetch('data/db_tren_destino_cabred.json'),
                fetch('data/db_tren_destino_retiro.json')
            ]);

            if (!resCabred.ok || !resRetiro.ok) {
                throw new Error("No se pudieron encontrar los archivos JSON. Verifica la ruta.");
            }

            dbCabred = await resCabred.json();
            dbRetiro = await resRetiro.json();

            console.log("✅ Datos cargados correctamente:");
            console.log(`   -> Hacia Cabred: ${dbCabred.length} servicios`);
            console.log(`   -> Hacia Retiro: ${dbRetiro.length} servicios`);

            // POPULAR SELECTOR DE ESTACIONES
            // Usamos las claves del primer objeto para sacar los nombres de las estaciones
            if (dbCabred.length > 0) {
                // Filtramos claves que no sean estaciones (Servicio, Tren_ID)
                estacionesOrdenadas = Object.keys(dbCabred[0]).filter(k => k !== 'Servicio' && k !== 'Tren_ID');
                
                // Si el JSON tiene las estaciones en orden (Retiro -> Cabred).
                llenarSelectorEstaciones();
            } else {
                console.warn("⚠️ El JSON de Cabred está vacío.");
            }

        } catch (error) {
            console.error("❌ ERROR CRÍTICO:", error);
            alert("Error cargando horarios. Abre la consola (F12) para más detalles. \n\nNota: Si abriste el archivo con doble click, necesitas un servidor local (Live Server).");
        }
    }

    function llenarSelectorEstaciones() {
        stationSelect.innerHTML = '<option value="" disabled selected>Seleccione una estación</option>';
        estacionesOrdenadas.forEach(est => {
            const opt = document.createElement('option');
            opt.value = est; // El valor debe coincidir EXACTO con la clave del JSON
            opt.textContent = est;
            stationSelect.appendChild(opt);
        });
        console.log("✅ Selector de estaciones llenado.");
    }

    // --- 1. RELOJ ---
    function actualizarReloj() {
        const ahora = new Date();
        const horas = String(ahora.getHours()).padStart(2, '0');
        const minutos = String(ahora.getMinutes()).padStart(2, '0');
        const horaTexto = `${horas}:${minutos}`;
        
        if(clockTime1) clockTime1.textContent = horaTexto;
        if(clockTime2) clockTime2.textContent = horaTexto;
        
        if(clockDate1) {
            const dia = String(ahora.getDate()).padStart(2, '0');
            const mes = String(ahora.getMonth() + 1).padStart(2, '0');
            const anio = ahora.getFullYear();
            clockDate1.textContent = `${dia}/${mes}/${anio}`;
        }
    }
    setInterval(actualizarReloj, 1000);
    actualizarReloj();

    // --- 2. EVENT LISTENERS ---
    
    // Modo Oscuro
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        themeToggle.textContent = body.classList.contains('dark-mode') ? '☀' : '🌙';
    });

    // Checkbox
    checkHoliday.addEventListener('change', (e) => {
        checkIcon.textContent = e.target.checked ? "☑" : "☐";
    });

    // Refresh
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            if (!stationSelect.value) {
                window.location.reload();
            } else {
                procesarBusqueda(); // Recalcular sin recargar todo
            }
        });
    }

    // Navegación
    btnBack.addEventListener('click', () => {
        screenResults.classList.add('hidden');
        screenHome.classList.remove('hidden');
    });

    btnSearch.addEventListener('click', () => {
        errorMsg.classList.add('hidden');
        stationSelect.parentElement.style.borderColor = 'var(--border-color)';

        if (stationSelect.value === "") {
            errorMsg.classList.remove('hidden');
            stationSelect.parentElement.style.borderColor = '#ef4444'; 
            return;
        }

        procesarBusqueda();
    });

    // --- 3. LÓGICA DE BÚSQUEDA ---

    function procesarBusqueda() {
        const estacionSeleccionada = stationSelect.value;
        displayStation.textContent = estacionSeleccionada;

        console.log(`🔎 Buscando horarios para: ${estacionSeleccionada}`);

        // 1. Determinar Servicio (Lunes-Viernes o Dom/Feriado)
        const esFeriado = checkHoliday.checked;
        const hoy = new Date();
        const esDomingo = hoy.getDay() === 0; // 0 = Domingo
        
        // Etiqueta que busca en la columna 'Servicio' del JSON
        const filtroServicio = (esFeriado || esDomingo) ? "7_" : "1-6_";
        
        console.log(`   -> Filtro aplicado: ${filtroServicio} (Feriado/Dom: ${esFeriado || esDomingo})`);

        // 2. Procesar Tarjetas
        procesarSentido(cardCabred, dbCabred, estacionSeleccionada, filtroServicio, estacionesOrdenadas, true);
        procesarSentido(cardRetiro, dbRetiro, estacionSeleccionada, filtroServicio, estacionesOrdenadas, false);

        // Cambiar pantalla
        screenHome.classList.add('hidden');
        screenResults.classList.remove('hidden');
    }

    function procesarSentido(cardElement, db, miEstacion, filtroServicio, listaEstaciones, esAscendente) {
        // Validar Terminales (No mostrar "Hacia Cabred" si estoy en Cabred)
        const indexEstacion = listaEstaciones.indexOf(miEstacion);
        
        if (esAscendente && indexEstacion === listaEstaciones.length - 1) {
            console.log("   -> Ocultando tarjeta Cabred (estás en la terminal)");
            cardElement.classList.add('hidden');
            return;
        }
        if (!esAscendente && indexEstacion === 0) {
            console.log("   -> Ocultando tarjeta Retiro (estás en la terminal)");
            cardElement.classList.add('hidden');
            return;
        }
        
        cardElement.classList.remove('hidden');

        // FILTRADO DE TRENES
        const ahora = new Date();
        const horaActualStr = String(ahora.getHours()).padStart(2,'0') + ":" + String(ahora.getMinutes()).padStart(2,'0');

        const trenesCandidatos = db.filter(tren => {
            const servicio = tren.Servicio || "";
            const horaEnEstacion = tren[miEstacion]; // Accedemos dinámicamente: tren["Palermo"]
            
            // 1. Coincide el tipo de servicio?
            if (!servicio.includes(filtroServicio)) return false;
            
            // 2. ¿Para en esta estación? (No es null ni "----")
            if (!horaEnEstacion || horaEnEstacion.includes("----")) return false;

            // 3. ¿Es futuro?
            return horaEnEstacion > horaActualStr;
        });

        console.log(`   -> Trenes encontrados (${esAscendente ? 'A Cabred' : 'A Retiro'}): ${trenesCandidatos.length}`);

        // Ordenar por horario
        trenesCandidatos.sort((a, b) => a[miEstacion].localeCompare(b[miEstacion]));

        // Actualizar UI
        actualizarTarjetaUI(cardElement, trenesCandidatos, miEstacion, listaEstaciones, esAscendente);
    }

    function actualizarTarjetaUI(card, trenes, miEstacion, listaEstaciones, esAscendente) {
        const elDestination = card.querySelector('.destination');
        const elTimeBig = card.querySelector('.time-big');
        const elArrival = card.querySelector('.arrival-time');
        
        const elPrev = card.querySelector('.station-node.prev');
        const elCurr = card.querySelector('.station-node.current');
        const elNext = card.querySelector('.station-node.next');
        
        const elNextList = card.querySelector('.next-departures');
        elNextList.innerHTML = ''; // Limpiar lista anterior

        if (trenes.length === 0) {
            elTimeBig.textContent = "--";
            elTimeBig.className = "time-big color-red";
            elArrival.textContent = "No hay más servicios hoy";
            elPrev.textContent = "-";
            elCurr.textContent = miEstacion;
            elNext.textContent = "-";
            
            // Mensaje en la lista
            elNextList.innerHTML = '<div class="next-item"><span>Fin del servicio por hoy.</span></div>';
            return;
        }

        // TREN ACTUAL (El primero)
        const trenActual = trenes[0];
        const horaArribo = trenActual[miEstacion];
        const diffMinutos = calcularDiferenciaMinutos(horaArribo);
        
        // Destino Real (Puede terminar antes)
        const destinoReal = obtenerDestinoReal(trenActual, listaEstaciones, esAscendente);
        elDestination.textContent = destinoReal;

        // Render Tiempo Principal
        elTimeBig.textContent = diffMinutos + " min";
        aplicarColorTiempo(elTimeBig, diffMinutos);
        elArrival.textContent = `Arribo: ${horaArribo} hs`;

        // Render Flujo
        actualizarFlujoEstaciones(trenActual, miEstacion, elPrev, elCurr, elNext, listaEstaciones);

        // Render Siguientes (Máximo 2)
        const siguientes = trenes.slice(1, 3);
        
        if (siguientes.length === 0) {
            elNextList.innerHTML = '<div class="next-item"><span>No hay más servicios luego de este.</span></div>';
        } else {
            siguientes.forEach((t, i) => {
                const h = t[miEstacion];
                const diff = calcularDiferenciaMinutos(h);
                const label = i === 0 ? "Siguiente:" : "Subsiguiente:";
                
                const div = document.createElement('div');
                div.className = 'next-item';
                div.innerHTML = `<span>${label} <strong>${diff} min</strong> → ${h}hs</span>`;
                elNextList.appendChild(div);
            });
        }
    }

    // --- HELPERS ---

    function calcularDiferenciaMinutos(horaTrenStr) {
        const ahora = new Date();
        const [h, m] = horaTrenStr.split(':').map(Number);
        const fechaTren = new Date();
        fechaTren.setHours(h, m, 0, 0);

        if (fechaTren < ahora) {
            fechaTren.setDate(fechaTren.getDate() + 1); // Asumir día siguiente si es menor (ej. madrugada)
        }

        const diffMs = fechaTren - ahora;
        return Math.floor(diffMs / 60000);
    }

    function aplicarColorTiempo(el, minutos) {
        el.className = 'time-big';
        if (minutos < 5) el.classList.add('color-green');
        else if (minutos < 10) el.classList.add('color-dark-green');
        else if (minutos < 20) el.classList.add('color-yellow');
        else if (minutos <= 60) el.classList.add('color-orange');
        else el.classList.add('color-red');
    }

    function obtenerDestinoReal(tren, listaEstaciones, esAscendente) {
        let ordenBusqueda = esAscendente ? listaEstaciones : [...listaEstaciones].reverse();
        for (let i = ordenBusqueda.length - 1; i >= 0; i--) {
            const est = ordenBusqueda[i];
            const val = tren[est];
            if (val && !val.includes("----")) {
                return est;
            }
        }
        return esAscendente ? "Cabred" : "Retiro";
    }

    function actualizarFlujoEstaciones(tren, miEstacion, elPrev, elCurr, elNext, listaEstaciones) {
        elCurr.textContent = miEstacion;
        const paradasReales = listaEstaciones.filter(est => {
            const val = tren[est];
            return val && !val.includes("----");
        });
        const index = paradasReales.indexOf(miEstacion);

        if (index > 0) elPrev.textContent = paradasReales[index - 1];
        else elPrev.textContent = "Inicio";

        if (index < paradasReales.length - 1) elNext.textContent = paradasReales[index + 1];
        else elNext.textContent = "Fin";
    }

    // INICIAR
    init();
});
