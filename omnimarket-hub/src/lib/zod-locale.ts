import { z } from "zod";

// Mensajes de validación de Zod en español para todos los esquemas (cliente
// y servidor). Los campos de formulario más visibles definen además su propio
// mensaje, más natural que el genérico.
z.config(z.locales.es());
