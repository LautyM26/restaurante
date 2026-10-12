// Diccionario en inglés. `satisfies Record<MessageKey, string>` hace que una clave faltante o sobrante
// rompa la compilación (`npm run build`); el test `dictionaries.test.ts` lo verifica además en runtime.
import type { MessageKey } from './es'

export const en = {
  // Language selector
  'lang.label': 'Language',

  // Hero and table
  'hero.title': 'Order from\nyour table',
  'hero.subtitle': 'Pick your dishes, make them yours and send the order straight to the kitchen.',
  'hero.cta': 'See the menu',
  'table.badge': 'Table {n}',
  'table.notice': 'To order, scan the QR code on your table or ask our staff.',
  'table.checking': 'Checking your table',
  'table.unverified': "We couldn't verify your table. Check your connection.",

  // Common
  'common.retry': 'Try again',

  // Dish
  'dish.add': 'Add',
  'dish.soldOut': 'Sold out',
  'dish.required_one': 'Choose 1 option',
  'dish.required_other': 'Choose {count} options',
  'dish.maxReached': 'You can choose up to {max}',
  'dish.added': 'Added: {name} × {qty}',
  'dish.group.required': 'Required',
  'dish.group.optional': 'Optional',
  'dish.group.upTo': 'Up to {max}',
  'dish.option.unavailable': 'Unavailable',
  'dish.note.label': 'Note for the kitchen',
  'dish.note.placeholder': 'E.g. no onion',
  'dish.note.counter': '{count} of {max}',

  // Sheets and quantity
  'sheet.close': 'Close',
  'qty.label': 'Quantity',
  'qty.decrease': 'Decrease quantity',
  'qty.increase': 'Increase quantity',

  // Current order
  'cart.maxPerDish': 'Maximum 20 per dish',
  'cart.inProgress': 'Order in progress',
  'cart.units_one': '{count} item',
  'cart.units_other': '{count} items',
  'cart.view': 'View order',
  'cart.remove': 'Remove',
  'cart.send': 'Send order',
  'cart.sending': 'Sending order',
  'cart.edit': 'Edit order',
  'cart.error.network': "We couldn't send your order. Check your connection and try again.",
  'cart.error.unresolved': "We don't know if your order arrived. Try again: it won't be duplicated.",
  'cart.error.validation': "We couldn't process your order. Check quantities and notes.",
  'cart.line.dish_unavailable': 'This dish is no longer available. Remove it to continue.',
  'cart.line.dish_not_found': 'This dish is no longer on the menu. Remove it to continue.',
  'cart.line.option_unavailable': 'A chosen option is no longer available. Remove the dish and add it again.',
  'cart.line.option_not_found': 'A chosen option no longer exists. Remove the dish and add it again.',
  'cart.line.selection_invalid': "This dish's options changed. Remove it and add it again.",
  'cart.price.title': 'The total changed',
  'cart.price.body': 'Before {old}, now {new}.',
  'cart.price.accept': 'Accept and send',
  'cart.price.review': 'Review order',

  // My orders
  'orders.title': 'My orders',
  'orders.table': 'Table {n}',
  'orders.sent': 'Order sent',
  'orders.more': 'Order something else',
  'orders.empty': "You haven't sent any orders from this phone yet.",
  'orders.cancelled': 'This order was cancelled. Please ask our staff.',
  'orders.delayed': 'Your order is taking a while, please tell your server.',
  'orders.announce': 'Order {code}: {status}',
  'orders.active_one': 'My orders, 1 active',
  'orders.active_other': 'My orders, {count} active',
  'orders.news': 'There are updates on your orders',

  // Order status
  'status.pending': 'Sent',
  'status.accepted': 'Confirmed',
  'status.preparing': 'Being prepared',
  'status.ready': 'Ready to serve',
  'status.delivered': 'Served',
  'status.cancelled': 'Cancelled',

  // Menu
  'menu.error': "We couldn't load the menu.",
  'menu.offline': "You're offline.",
  'menu.empty': "The menu isn't available right now. Please ask our staff.",
  'menu.offlineHint': 'The menu will load by itself when the connection is back.',
  'menu.loading': 'Loading the menu',
  'menu.categories': 'Menu categories',

  // Dietary tags on dishes
  'tag.vegetarian': 'Vegetarian',
  'tag.vegan': 'Vegan',
  'tag.gluten_free': 'Gluten free',
  'tag.spicy': 'Spicy',
} satisfies Record<MessageKey, string>
