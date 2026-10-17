// Carta de demostración "Fogón" (plan §7.2): 6 categorías, platos en español e inglés y los casos límite
// que la interfaz debe resolver: plato agotado, opción no disponible, grupo obligatorio sin opciones
// disponibles (P4: se muestra "Agotado") y plato de una categoría inexistente (CL36: se descarta).
// Importes en centavos de ARS: 1.240.000 = $ 12.400.
import type { Category, Dish, DietaryTag, Menu, Option, OptionGroup } from '../../domain/types'

const option = (id: string, es: string, en: string, priceDeltaCents = 0, available = true): Option => ({
  id,
  name: { es, en },
  priceDeltaCents,
  available,
})

const group = (
  id: string,
  es: string,
  en: string,
  type: OptionGroup['type'],
  min: number,
  max: number,
  options: Option[],
): OptionGroup => ({ id, name: { es, en }, type, min, max, options })

/** Grupo obligatorio de elección única. */
const pick = (id: string, es: string, en: string, options: Option[]) => group(id, es, en, 'single', 1, 1, options)

interface DishSpec {
  id: string
  categoryId: string
  order: number
  name: [es: string, en: string]
  description: [es: string, en: string]
  priceCents: number
  tags?: DietaryTag[]
  available?: boolean
  featured?: boolean
  optionGroups?: OptionGroup[]
}

const dish = (spec: DishSpec): Dish => ({
  id: spec.id,
  categoryId: spec.categoryId,
  order: spec.order,
  name: { es: spec.name[0], en: spec.name[1] },
  description: { es: spec.description[0], en: spec.description[1] },
  priceCents: spec.priceCents,
  tags: spec.tags ?? [],
  available: spec.available ?? true,
  featured: spec.featured ?? false,
  optionGroups: spec.optionGroups ?? [],
})

const cooking = () =>
  pick('cooking', 'Punto de cocción', 'Doneness', [
    option('juicy', 'Jugoso', 'Rare'),
    option('medium', 'A punto', 'Medium'),
    option('well-done', 'Bien cocido', 'Well done', 0, false),
  ])

const grillSides = () =>
  pick('side', 'Guarnición', 'Side', [
    option('fries', 'Papas fritas', 'French fries'),
    option('mixed-salad', 'Ensalada mixta', 'Mixed salad'),
    option('mash', 'Puré de papas', 'Mashed potatoes', 150000),
  ])

const categories: Category[] = [
  { id: 'starters', name: { es: 'Entradas', en: 'Starters' }, order: 1, visual: 'starter' },
  { id: 'grill', name: { es: 'Parrilla', en: 'From the grill' }, order: 2, visual: 'grill' },
  { id: 'mains', name: { es: 'Platos principales', en: 'Main courses' }, order: 3, visual: 'main' },
  { id: 'pasta', name: { es: 'Pastas', en: 'Pasta' }, order: 4, visual: 'pasta' },
  { id: 'desserts', name: { es: 'Postres', en: 'Desserts' }, order: 5, visual: 'dessert' },
  { id: 'drinks', name: { es: 'Bebidas', en: 'Drinks' }, order: 6, visual: 'drink' },
]

const dishes: Dish[] = [
  // Entradas
  dish({
    id: 'provoleta',
    categoryId: 'starters',
    order: 1,
    name: ['Provoleta a la parrilla', 'Grilled provolone'],
    description: ['Queso provolone fundido con orégano y tomate.', 'Melted provolone with oregano and tomato.'],
    priceCents: 780000,
    tags: ['vegetarian'],
    featured: true,
    optionGroups: [
      group('toppings', 'Extras', 'Extras', 'multiple', 0, 2, [
        option('chimichurri', 'Chimichurri', 'Chimichurri'),
        option('ham', 'Jamón crudo', 'Cured ham', 220000),
        option('honey', 'Miel', 'Honey', 90000),
      ]),
    ],
  }),
  dish({
    id: 'empanadas',
    categoryId: 'starters',
    order: 2,
    name: ['Empanadas (x3)', 'Empanadas (x3)'],
    description: ['Horneadas, con relleno a elección.', 'Baked, with the filling of your choice.'],
    priceCents: 690000,
    optionGroups: [
      pick('filling', 'Relleno', 'Filling', [
        option('beef', 'Carne cortada a cuchillo', 'Hand-cut beef'),
        option('ham-cheese', 'Jamón y queso', 'Ham and cheese'),
        option('humita', 'Humita', 'Sweet corn', 0, false),
      ]),
    ],
  }),
  dish({
    id: 'rucula-salad',
    categoryId: 'starters',
    order: 3,
    name: ['Ensalada de rúcula', 'Arugula salad'],
    description: ['Rúcula, tomates cherry y parmesano.', 'Arugula, cherry tomatoes and parmesan.'],
    priceCents: 640000,
    tags: ['vegetarian', 'gluten_free'],
  }),

  // Parrilla
  dish({
    id: 'bife-chorizo',
    categoryId: 'grill',
    order: 1,
    name: ['Bife de chorizo', 'Sirloin steak'],
    description: ['400 g a la parrilla con sal gruesa.', '400 g grilled with coarse salt.'],
    priceCents: 1850000,
    tags: ['gluten_free'],
    featured: true,
    optionGroups: [
      cooking(),
      grillSides(),
      group('sauces', 'Salsas', 'Sauces', 'multiple', 0, 2, [
        option('chimichurri', 'Chimichurri', 'Chimichurri'),
        option('criolla', 'Salsa criolla', 'Criolla sauce'),
        option('pepper', 'Pimienta', 'Peppercorn', 120000),
      ]),
    ],
  }),
  dish({
    id: 'asado-tira',
    categoryId: 'grill',
    order: 2,
    name: ['Asado de tira', 'Short ribs'],
    description: ['Costilla cocida lentamente, con hueso.', 'Slow-cooked bone-in ribs.'],
    priceCents: 1690000,
    tags: ['gluten_free'],
    featured: true,
    optionGroups: [cooking(), grillSides()],
  }),
  dish({
    id: 'entrana',
    categoryId: 'grill',
    order: 3,
    name: ['Entraña', 'Skirt steak'],
    description: ['Corte fino y sabroso, agotado por hoy.', 'Thin, flavorful cut, sold out today.'],
    priceCents: 1720000,
    available: false,
    optionGroups: [cooking()],
  }),
  dish({
    id: 'parrillada-two',
    categoryId: 'grill',
    order: 4,
    name: ['Parrillada para dos', 'Grill platter for two'],
    description: ['Vacío, chorizo, morcilla y provoleta.', 'Flank steak, sausage, black pudding and provolone.'],
    priceCents: 3480000,
    featured: true,
  }),

  // Platos principales
  dish({
    id: 'fogon-burger',
    categoryId: 'mains',
    order: 1,
    name: ['Hamburguesa Fogón', 'Fogón burger'],
    description: ['Carne de 200 g, cebolla caramelizada y pan de papa.', '200 g patty, caramelized onion and potato bun.'],
    priceCents: 1240000,
    featured: true,
    optionGroups: [
      cooking(),
      group('extras', 'Extras', 'Extras', 'multiple', 0, 3, [
        option('cheddar', 'Cheddar', 'Cheddar', 150000),
        option('bacon', 'Panceta', 'Bacon', 200000),
        option('egg', 'Huevo frito', 'Fried egg', 120000),
        option('pickles', 'Pepinillos', 'Pickles'),
      ]),
    ],
  }),
  dish({
    id: 'milanesa-napolitana',
    categoryId: 'mains',
    order: 2,
    name: ['Milanesa napolitana', 'Neapolitan breaded cutlet'],
    description: ['Con jamón, salsa de tomate y mozzarella gratinada.', 'With ham, tomato sauce and melted mozzarella.'],
    priceCents: 1480000,
    optionGroups: [grillSides()],
  }),
  dish({
    id: 'mushroom-risotto',
    categoryId: 'mains',
    order: 3,
    name: ['Risotto de hongos', 'Mushroom risotto'],
    description: ['Arroz cremoso con hongos de estación.', 'Creamy rice with seasonal mushrooms.'],
    priceCents: 1390000,
    tags: ['vegetarian', 'gluten_free'],
  }),
  // Caso límite P4: está disponible pero ninguna salsa lo está, así que no se puede pedir.
  dish({
    id: 'grilled-salmon',
    categoryId: 'mains',
    order: 4,
    name: ['Salmón grillado', 'Grilled salmon'],
    description: ['Con vegetales asados y salsa a elección.', 'With roasted vegetables and a sauce of your choice.'],
    priceCents: 1920000,
    optionGroups: [
      pick('sauce', 'Salsa', 'Sauce', [
        option('lemon-butter', 'Manteca y limón', 'Lemon butter', 0, false),
        option('dill', 'Eneldo', 'Dill', 0, false),
      ]),
    ],
  }),

  // Pastas
  dish({
    id: 'gnocchi',
    categoryId: 'pasta',
    order: 1,
    name: ['Ñoquis de papa', 'Potato gnocchi'],
    description: ['Caseros, con la salsa que prefieras.', 'Homemade, with the sauce you prefer.'],
    priceCents: 1260000,
    tags: ['vegetarian'],
    featured: true,
    optionGroups: [
      pick('sauce', 'Salsa', 'Sauce', [
        option('fileto', 'Fileto', 'Tomato'),
        option('bolognese', 'Bolognesa', 'Bolognese', 100000),
        option('four-cheese', 'Cuatro quesos', 'Four cheese', 140000),
      ]),
    ],
  }),
  dish({
    id: 'ricotta-ravioli',
    categoryId: 'pasta',
    order: 2,
    name: ['Ravioles de ricota', 'Ricotta ravioli'],
    description: ['Rellenos de ricota y nuez, con manteca y salvia.', 'Filled with ricotta and walnut, with butter and sage.'],
    priceCents: 1310000,
    tags: ['vegetarian'],
  }),
  dish({
    id: 'pesto-spaghetti',
    categoryId: 'pasta',
    order: 3,
    name: ['Espagueti al pesto', 'Spaghetti with pesto'],
    description: ['Albahaca fresca, ajo y piñones.', 'Fresh basil, garlic and pine nuts.'],
    priceCents: 1180000,
    tags: ['vegan'],
  }),

  // Postres
  dish({
    id: 'flan',
    categoryId: 'desserts',
    order: 1,
    name: ['Flan con dulce de leche', 'Flan with dulce de leche'],
    description: ['Casero, con crema chantilly.', 'Homemade, with whipped cream.'],
    priceCents: 590000,
    tags: ['vegetarian', 'gluten_free'],
    featured: true,
  }),
  dish({
    id: 'chocolate-volcano',
    categoryId: 'desserts',
    order: 2,
    name: ['Volcán de chocolate', 'Chocolate lava cake'],
    description: ['Centro fundido, con helado de crema.', 'Molten center, with vanilla ice cream.'],
    priceCents: 740000,
    tags: ['vegetarian'],
    featured: true,
  }),
  dish({
    id: 'ice-cream',
    categoryId: 'desserts',
    order: 3,
    name: ['Helado artesanal', 'Artisan ice cream'],
    description: ['Elegí hasta tres gustos.', 'Choose up to three flavors.'],
    priceCents: 560000,
    tags: ['vegetarian', 'gluten_free'],
    optionGroups: [
      group('flavors', 'Gustos', 'Flavors', 'multiple', 1, 3, [
        option('dulce-de-leche', 'Dulce de leche', 'Dulce de leche'),
        option('chocolate', 'Chocolate', 'Chocolate'),
        option('vanilla', 'Vainilla', 'Vanilla'),
        option('strawberry', 'Frutilla', 'Strawberry', 0, false),
      ]),
    ],
  }),

  // Bebidas
  dish({
    id: 'craft-beer',
    categoryId: 'drinks',
    order: 1,
    name: ['Cerveza artesanal', 'Craft beer'],
    description: ['Rubia de la casa, bien fría.', 'House blonde ale, ice cold.'],
    priceCents: 480000,
    featured: true,
    optionGroups: [
      pick('size', 'Tamaño', 'Size', [
        option('half-liter', '500 cc', '500 ml'),
        option('liter', '1 litro', '1 liter', 420000),
      ]),
    ],
  }),
  dish({
    id: 'soda',
    categoryId: 'drinks',
    order: 2,
    name: ['Gaseosa', 'Soda'],
    description: ['Botella de 500 cc.', '500 ml bottle.'],
    priceCents: 350000,
    optionGroups: [
      pick('kind', 'Sabor', 'Flavor', [
        option('cola', 'Cola', 'Cola'),
        option('lemon-lime', 'Lima-limón', 'Lemon-lime'),
        option('orange', 'Naranja', 'Orange'),
      ]),
    ],
  }),
  dish({
    id: 'mineral-water',
    categoryId: 'drinks',
    order: 3,
    name: ['Agua mineral', 'Mineral water'],
    description: ['Botella de 500 cc.', '500 ml bottle.'],
    priceCents: 290000,
    optionGroups: [
      pick('fizz', 'Gas', 'Fizz', [option('still', 'Sin gas', 'Still'), option('sparkling', 'Con gas', 'Sparkling')]),
    ],
  }),
  // Caso límite CL36: su categoría no existe; la interfaz lo descarta.
  dish({
    id: 'ghost-dish',
    categoryId: 'ghost-category',
    order: 1,
    name: ['Plato fantasma', 'Ghost dish'],
    description: ['No debería mostrarse.', 'Should not be shown.'],
    priceCents: 100000,
  }),
]

/** Carta base de la demostración (sin los cambios de `setPrice` / `setAvailable`). */
export const baseMenu: Menu = { categories, dishes }
