// Diferenciales de producto Drean por SKU (base de conocimiento para generar
// contenido específico, no genérico). Fuente: planilla "Diferenciales de
// Producto para Contenidos". Alimenta la generación RRSS y UGC.

export interface Diferencial { atributo: string; detalle: string; }

export const DIFERENCIALES: Record<string, Diferencial[]> = {
  "LFDR1114ISG0": [
    { atributo: "Conformal Coating", detalle: "La placa electrónica está recubierta con conformal coating, una película polimérica que protege e impide el contacto directo de los componentes con la humedad y el polvo, asegurando así su máxima vida útil." },
    { atributo: "Lavado 14 Min", detalle: "Especialmente diseñado para cargas pequeñas de ropa, el programa 14 minutos permite lavar tus prendas de manera rápida y sencilla. Si estás apurado y necesitás usar esa prenda preferida que mejor te queda, podés utilizar este programa de lavado y tema solucionado. Además, los lavarropas Drean cuentan con el programa inteligente de 39 minutos, que permite mezclar diferentes tipos de prendas ajustando de manera automática las mejores condiciones de lavado, ideal para un lavado diario eficiente." },
    { atributo: "Programa Vapor", detalle: "Con el programa vapor podrás eliminar olores fácilmente de tu ropa sin utilizar jabón ni flujo de agua. Ideal para refrescar las prendas y quitar suavemente el polvo acumulado, suavizando los tejidos." },
    { atributo: "Tambor Pillow Drum XXL", detalle: "Tambor equipado con tecnología Pillow Drum, una textura geométrica soft conformada por almohadillas 3D, que te aseguran el mejor cuidado hasta de tus prendas más delicadas. Gracias a la precisión casi absoluta (0,05mm) de la tecnología de soldadura láser, el tambor no presenta imperfecciones en su superficie y las prendas se deslizan de manera suave y delicada, evitando hasta la más mínima fricción y asegurando que tu ropa se mantenga como nueva." },
    { atributo: "Diametro del tambor 525 mm", detalle: "Gracias al diámetro de su tambor de 525 mm y su tambor XXL, podés lavar hasta 12 kg de ropa. El diametro del tambor grande mejora le experencia de sacar y colocar la ropa, no tiene que ver con la capacidad en kg." },
    { atributo: "Tecnologia Smart Wash", detalle: "Es un innovador sistema de sensores y algoritmos que detectan el peso de la ropa, ajustando de manera inteligente y automática la cantidad de agua, jabón y patrones de agitación para realizar el mejor lavado de tus prendas." },
    { atributo: "Tratamiento ABT", detalle: "Los lavarropas Drean cuentan con tratamiento “ABT” (Anti-Bacterial Treatment) en el fuelle, ayudando a eliminar hasta el 99.9% de las bacterias* haciendo un ambiente de lavado más limpio e higiénico. Además, con el programa Sanitizado, podrás realizar un lavado a altas temperaturas, garantizando la eliminación de los ácaros y hasta el 99,9% de bacterias presentes en la ropa." },
    { atributo: "Dual Spray y Programa Limpieza de Tambor", detalle: "Equipados con Dual Spray*, un innovador sistema con doble rociador, que permite realizar la limpieza de la junta y la puerta del lavarropas por separado en cada enjuague. Para una limpieza más profunda, vienen equipados con el programa Limpieza de Tambor, que garantiza la eliminación absoluta de residuos, suciedad y los olores acumulados en el tambor y el fuelle." },
  ],
  "LPDR1165LG": [
    { atributo: "Eco-Inverter Direct Motion", detalle: "Equipados con la tecnología Eco-Inverter Direct Motion*, combinan eficiencia, durabilidad y confort. Ofrecen el mejor rendimiento con un funcionamiento más armónico, reduciendo significativamente las vibraciones y el ruido del motor." },
    { atributo: "ID System", detalle: "ID SYSTEM, es un innovador sistema de sensores y algoritmos, que detectan el peso de la ropa, ajustando de manera inteligente y automática la cantidad de agua, tiempo y patrones de agitación para realizar el mejor lavado de tus prendas." },
    { atributo: "Power Wash", detalle: "Power Wash es una tecnología de enjuague en cascada 360° que se realiza durante el centrifugado, permitiendo disolver de manera absoluta los restos de jabón, logrando una limpieza más eficiente, con el mínimo consumo de agua." },
    { atributo: "Tratamiento ABT", detalle: "Los lavarropas Drean cuentan con tratamiento “ABT” (Anti-Bacterial Treatment) en el agitador, ayudando a eliminar el 99.9% de las bacterias* haciendo un ambiente de lavado más limpio e higiénico. Además, incorporan la función de secado de tambor, que elimina la humedad interna y externa al finalizar el lavado, previniendo la formación de moho y hongos." },
    { atributo: "Filtro Magico", detalle: "A diferencia de los filtros convencionales, el innovador filtro mágico 3D atrapa pelusas y restos de papel de forma más efectiva y completa, evitando que vuelvan al tambor. Con doble sistema de filtrado, duplica la capacidad de captura, garantizando prendas más limpias y un entorno de lavado más higiénico." },
    { atributo: "Sistema Soft Closing Door", detalle: "La puerta tiene un sistema de amortiguación que hace que cierre de manera delicada, evitando golpes, posibles roturas, accidentes." },
    { atributo: "Pillow Drum", detalle: "Tambor equipado con tecnología Pillow Drum, una textura geométrica soft conformada por almohadillas 3D, que te aseguran el mejor cuidado hasta de tus prendas más delicadas. Gracias a la precisión casi absoluta (0,05mm) de la tecnología de soldadura láser, el tambor no presenta imperfecciones en su superficie y las prendas se deslizan de manera suave y delicada, evitando hasta la más mínima fricción y asegurando que tu ropa se mantenga como nueva." },
    { atributo: "Air Fresh", detalle: "Gracias al innovador programa AIR FRESH, podés eliminar olores y reducir arrugas de forma simple y eficaz mediante la circulación de aire fresco. Si olvidás retirar la ropa a tiempo, el tambor gira suavemente de manera automática, renovando el aire interior a través de las ranuras AIR VENT ubicadas en la tapa superior. Así evitás el olor a humedad y cuidás tus prendas, dejándolas más frescas y con menos arrugas." },
    { atributo: "Programa Acolchado", detalle: "Lavá tus acolchados con el máximo cuidado y eficacia de lavado. Equipados con uno de los programas más deseados del mercado, ahora lavar tus acolchados es posible, sin tintorerías ni salir de tu hogar." },
  ],
  "LSCDR1208SG0": [
    { atributo: "Tambor Pillow Drum XXL", detalle: "Tambor equipado con tecnología Pillow Drum, una textura geométrica soft conformada por almohadillas de solo 2,2 mm de diámetro, te aseguran el mejor cuidado hasta de tus prendas más delicadas. Gracias a la precisión casi absoluta (0,05mm) de la tecnología de soldadura láser, el tambor no presenta imperfecciones en su superficie y las prendas se deslizan de manera suave y delicada, evitando hasta la más mínima fricción y asegurando que tu ropa se mantenga como nueva." },
    { atributo: "Diametro del tambor 525 mm", detalle: "Gracias al diámetro de su tambor de 525 mm y su tambor XXL, podés lavar hasta 12 kg de ropa. El diametro del tambor grande mejora le experencia de sacar y colocar la ropa, no tiene que ver con la capacidad en kg." },
    { atributo: "Programa Refresh", detalle: "Los lavasecarropas Drean cuentan con el programa Refresh, gracias a su tecnología de micro vapor, podes eliminar los olores y reducir las arrugas de tus prendas de la manera más efectiva, sin utilizar agua y/o detergentes. Ahorrá agua y simplifica tu vida con la mejor tecnología e innovación." },
    { atributo: "Lavado Express 15 min", detalle: "Especialmente diseñado para cargas pequeñas de ropa, este útil programa te permite lavar tus prendas en tan solo pocos minutos. Si estás apurado y necesitás usar esa prenda preferida que mejor te queda, podés utilizar el programa de lavado de 15 minutos y tema solucionado." },
    { atributo: "Programa Acolchado", detalle: "Equipados con uno de los programas más deseados del mercado, ahora lavar tus acolchados King Size es posible, sin tintorería ni salir de tu hogar." },
    { atributo: "Tratamiento ABT", detalle: "Los lavasecarropas Drean cuentan con tratamiento “ABT” (Anti-Bacterial Treatment) en la jabonera y el fuelle, que eliminan el 99.9% de las bacterias* haciendo un ambiente de lavado más limpio e higiénico." },
    { atributo: "Conformal Coating", detalle: "La placa electrónica está recubierta con conformal coating, una película polimérica que protege e impide el contacto directo de los componentes con la humedad y el polvo, asegurando así su máxima vida útil." },
  ],
  "CD5617AI0": [
    { atributo: "Air Fryer XXL", detalle: "Equipadas con Tecnología Air Fryer XXL, el Gold Estándar de la categoría, únicas en el mercado. Cociná más rápido, saludable y sabroso, con el sistema exclusivo de convección del horno y la novedosa tecnología Air Fryer. El calor envuelve los alimentos, manteniéndolos crujientes y dorados por fuera, y jugosos por dentro. Sorprende y agasaja a tus invitados con las comidas más sanas y deliciosas." },
    { atributo: "Hornallas Dual Professional Ring", detalle: "Innovador sistema de cocción, Duo Professional Ring, una hornalla exclusiva de doble anillo que te brinda la máxima potencia para cocinar tus comidas optimizando tiempos y reduciendo el consumo de gas. Solo como referencia, con esta innovadora tecnología podrás hervir 2 litros de agua en tan solo 9 minutos." },
    { atributo: "Termostato en horno", detalle: "Selector de 5 temperaturas con termostato en horno, esto te permite asegurar que la temperatura que vos seleccionas realmente sea la que esta cocicando tus cocinas en el horno. La mayoría de las cocinas no tiene termostato en el horno, por lo tanto no pueden asegurar la precisión del calor que vos seleccionas. Es clave para que tus comidas salgan con la cocción y dorado perfecot." },
    { atributo: "Grill Electrico", detalle: "Equipadas con Grill eléctrico en el horno, te permite asar, dorar o gratinar para darle el toque de distinción y exquisitez a tus recetas. Podés utilizar el Grill para asar las más sabrosas costillas, brochette, pescados y verduras, como si fuesen a la parrilla; o simplemente luego de hornear tus comidas preferidas, darle el toque gourmet final con el gratinado o dorado perfecto." },
    { atributo: "Horno por Convección", detalle: "Podés hornear de la manera tradicional o utilizar la función de horneado por convección. Este innovador sistema utiliza un ventilador que ayuda a distribuir el calor de manera uniforme y homogénea por todo su interior, permitiendo cocinar tus comidas de forma más rápida, ahorrando energía y con el punto justo de cocción." },
    { atributo: "Tecnología Perfect Cook", detalle: "Equipadas con Tecnología Perfect Cook, las ranuras del piso semicircular permiten que el aire caliente circule de manera envolvente dentro del horno, garantizando cocciones más parejas y uniformes. Gracias a esta tecnología, se logra la temperatura precisa y un calor uniforme en cada rincón del horno, consiguiendo un dorado perfecto y la cocción en su punto justo." },
    { atributo: "Perillas con encendido a na mano", detalle: "Perillas de metal con encendido eléctrico integrado en horno y hornallas: mayor comodidad y precisión." },
    { atributo: "Cubierta sellada de acero inoxidable", detalle: "" },
    { atributo: "Tapa de vidrio templado", detalle: "" },
    { atributo: "Cajon parrilla deslizable y abatible", detalle: "Las nuevas cocinas Drean están equipadas con un práctico y funcional cajón parrilla. No solo podrás cocinar de mil maneras en su fantástico horno, sino que también podrás calentar, asar, dorar y gratinar tus comidas más deliciosas en el cajón parrilla. Con sistema deslizable y puerta rebatible, ya no tenés excusas para lucirte ante tus seres queridos." },
  ],
  "CD6009EI": [
    { atributo: "Display Digital", detalle: "Una de las unicas cocinas del mercado con display digital, reloj y timer, nuestras cocinas Drean te brindan la rapidez y versatilidad que necesitás para preparar tus comidas favoritas." },
    { atributo: "Timer + Reloj", detalle: "" },
    { atributo: "Hornallas Triple Ring", detalle: "Unicas cocinas del mercado equipadas con un innovador sistema de cocción, Hornalla triple ring, una hornalla exclusiva de triple anillo que te brinda la máxima potencia para cocinar tus comidas optimizando tiempos y reduciendo el consumo de gas." },
    { atributo: "Grill a Gas", detalle: "Podés utilizar el Grill para asar las más sabrosas costillas, brochette, pescados y verduras, como si fuesen a la parrilla; o simplemente luego de hornear tus comidas preferidas, darle el toque gourmet final con el gratinado o dorado perfecto." },
    { atributo: "Perillas con encendido a na mano", detalle: "Perillas de metal con encendido eléctrico integrado en horno y hornallas: mayor comodidad y precisión." },
    { atributo: "Tapa de vidrio templado", detalle: "Con cierre soft close." },
    { atributo: "Cubierta sellada de acero inoxidable", detalle: "" },
  ],
  "CD7609EI": [
    { atributo: "Display Digital", detalle: "Una de las unicas cocinas del mercado con display digital, reloj y timer, nuestras cocinas Drean te brindan la rapidez y versatilidad que necesitás para preparar tus comidas favoritas." },
    { atributo: "Timer + Reloj", detalle: "" },
    { atributo: "Grill a Gas", detalle: "Podés utilizar el Grill para asar las más sabrosas costillas, brochette, pescados y verduras, como si fuesen a la parrilla; o simplemente luego de hornear tus comidas preferidas, darle el toque gourmet final con el gratinado o dorado perfecto." },
    { atributo: "Perillas con encendido a na mano", detalle: "Perillas de metal con encendido eléctrico integrado en horno y hornallas: mayor comodidad y precisión." },
    { atributo: "5 hornallas", detalle: "" },
    { atributo: "Hornallas Triple Ring", detalle: "Unicas cocinas del mercado equipadas con un innovador sistema de cocción, Hornalla triple ring, una hornalla exclusiva de triple anillo que te brinda la máxima potencia para cocinar tus comidas optimizando tiempos y reduciendo el consumo de gas." },
    { atributo: "Tres parrillas de fundición", detalle: "Versatilidad y robustez para cocinar." },
    { atributo: "Cubierta sellada de acero inoxidable", detalle: "" },
    { atributo: "Tapa de vidrio templado", detalle: "Con cierre soft close." },
  ],
  "DSP610IORSS0": [
    { atributo: "IA - AUTO SET", detalle: "Función inteligente que configura automáticamente la temperatura ideal para tus alimentos de acuerdo a la temperatura del ambiente. Además, cuenta con una innovadora función que te permite seleccionar una temperatura específica para cada zona de la heladera. Controlá la temperatura del freezer y del refrigerador de manera independiente." },
    { atributo: "Dispenser de agua y 2 tipos de hielo exterior", detalle: "No tendrás que preocuparte por rellenar la cubetera, ya que este modelo cuenta con conexión directa a la red de agua. Automáticamente se fabrica y almacena el hielo en su Ice Tank, para que tengas hielo al instante de manera muy simple. Sin abrir la heladera, podrás extraer cubitos o hielo triturado." },
    { atributo: "Super Cool y Super Freeze", detalle: "Enfriamiento rápido en heladera y freezer. Ideal para festejos de último minuto o al guardar la compra del supermercado sin perder frío en el resto de los alimentos." },
    { atributo: "Modo Vacaciones", detalle: "Consume el mínimo de energía y mantiene la temperatura estable hasta tu regreso." },
    { atributo: "Humidity Zone", detalle: "Crisper especial para conservar frutas y verduras con las vitaminas, nutrientes y las texturas intactas. Mantiene la humedad y temperatura ideal y evita la oxidación temprana de los alimentos." },
    { atributo: "Aislante térmico en puertas", detalle: "Diseñadas y producidas con los más altos estándares internacionales en conservación de frío. Equipadas con aislante térmico de alta eficiencia, aseguran la mínima transferencia térmica entre el interior de la heladera y el ambiente. El frío no se va." },
  ],
  "DSP480LKRSS0": [
    { atributo: "Multi Air Flow", detalle: "Tecnología innovadora y exclusiva de refrigeración, que mantiene la temperatura y humedad óptima para conservar tus alimentos. Su sistema de recirculación de frío genera un clima ideal de conservación en cada compartimento y rincón de la heladera, asegurando una temperatura estable que evita la fatiga térmica de los alimentos. Mantené las vitaminas, nutrientes, sabores y texturas de tus alimentos intactos por más tiempo, solo con Drean." },
    { atributo: "IA - AUTO SET", detalle: "Función inteligente que configura automáticamente la temperatura ideal para tus alimentos de acuerdo a la temperatura del ambiente. Controlá la temperatura del freezer y del refrigerador de manera independiente." },
    { atributo: "Modo Vacaciones", detalle: "Consume el mínimo de energía y mantiene la temperatura estable hasta tu regreso." },
    { atributo: "Super Cool y Super Freeze", detalle: "Enfriamiento rápido en heladera y freezer. Ideal para festejos de último minuto o al guardar la compra del supermercado sin perder frío en el resto de los alimentos." },
    { atributo: "Tecnología Antibacterial DEO FRESH", detalle: "Mantiene el aire interno libre de bacterias y malos olores con hasta el 99,9 % de eficacia, garantizando que tus alimentos se conserven frescos, seguros y con un sabor impecable en todo momento. Gracias a su exclusivo filtro DEO Fresh ubicado en el sistema de ventilación, se genera un flujo de aire limpio constantemente, eliminando bacterias y moho. Esto evita la contaminación cruzada entre compartimentos y ayuda a conservar la integridad y frescura de los alimentos por más tiempo." },
    { atributo: "Aislante térmico en puertas", detalle: "Diseñadas y producidas con los más altos estándares internacionales en conservación de frío. Equipadas con aislante térmico de alta eficiencia, aseguran la mínima transferencia térmica entre el interior de la heladera y el ambiente. El frío no se va." },
  ],
  "DTP469LKRSS0": [
    { atributo: "TWIN Inverter", detalle: "Lo último en generación de frío. Esta innovadora tecnología cuenta doble equipamiento Inverter. Controla de forma independiente el compresor y el ventilador, optimizando su velocidad según la necesidad. Esto permite un enfriamiento más preciso, ahorro de energía y menor ruido. Ideal para quienes buscan máxima eficiencia y frescura constante." },
    { atributo: "IA - AUTO SET", detalle: "Función inteligente que configura automáticamente la temperatura ideal para tus alimentos de acuerdo a la temperatura del ambiente. Controlá la temperatura del freezer y del refrigerador de manera independiente." },
    { atributo: "360° Cooling", detalle: "Tecnología innovadora y exclusiva de refrigeración, que mantiene la temperatura y humedad óptima para conservar tus alimentos. Su sistema de recirculación de frío genera un clima ideal de conservación en cada compartimento y rincón de la heladera, asegurando una temperatura estable que evita la fatiga térmica de los alimentos. Mantené las vitaminas, nutrientes, sabores y texturas de tus alimentos intactos por más tiempo, solo con Drean." },
    { atributo: "Humidity Zone", detalle: "Frutas y verduras frescas el doble de tiempo*. El cajón Humidity Zone cuenta con la tecnología exclusiva HCS (Sistema de Control de Humedad), una membrana de fibra vegetal que mantiene los niveles de humedad al 90% dentro del compartimento. Esta presición de humedad evita la formación de agua condensada en el interior del cajón, manteniendo así por el doble de tiempo el contenido nutricional, textura y sabores de los alimentos." },
    { atributo: "Magic Zone", detalle: "Elegí la temperatura adecuada para cada tipo de alimento. El cajón Magic Zone te permite ajustar la temperatura dentro del compartimento moviendo un control deslizante, para que puedas almacenar tanto frutas y verduras, como carnes o pescado a una temperatura de 0°, dependiendo de tus necesidades de almacenamiento en ese momento." },
    { atributo: "Power Cool y Power Freeze", detalle: "Enfriamiento rápido en heladera y freezer. Ideal para festejos de último minuto o al guardar la compra del supermercado sin perder frío en el resto de los alimentos." },
    { atributo: "Modo Vacaciones", detalle: "Consume el mínimo de energía y mantiene la temperatura estable hasta tu regreso." },
    { atributo: "Aislante térmico en puertas", detalle: "Diseñadas y producidas con los más altos estándares internacionales en conservación de frío. Equipadas con aislante térmico de alta eficiencia, aseguran la mínima transferencia térmica entre el interior de la heladera y el ambiente. El frío no se va." },
  ],
};

export function getDiferenciales(sku: string | null | undefined): Diferencial[] {
  return sku ? (DIFERENCIALES[sku] ?? []) : [];
}

// Texto para inyectar en el prompt. Si se pasan `seleccion` (nombres de atributo),
// enfoca SÓLO en esos; si no, lista todos (acotados).
export function diferencialesTexto(sku: string | null | undefined, seleccion?: string[], max = 10): string {
  const all = getDiferenciales(sku);
  if (all.length === 0) return "";
  const sel = (seleccion ?? []).filter(Boolean);
  if (sel.length > 0) {
    const set = new Set(sel.map((s) => s.toLowerCase()));
    const filt = all.filter((d) => set.has(d.atributo.toLowerCase()));
    if (filt.length > 0) {
      const lineas = filt.map((d) => `- ${d.atributo}: ${d.detalle.slice(0, 260)}`);
      return `DIFERENCIALES ELEGIDOS — enfocá el contenido EN ESTOS (son los que se quieren destacar), con precisión y sin inventar:\n${lineas.join("\n")}`;
    }
  }
  const lineas = all.slice(0, max).map((d) => `- ${d.atributo}: ${d.detalle.slice(0, 240)}`);
  return `DIFERENCIALES REALES DE ESTE PRODUCTO (usá los que apliquen, con precisión, sin inventar):\n${lineas.join("\n")}`;
}
