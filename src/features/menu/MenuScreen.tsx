// La carta (RF7-RF10, RF13, RF34, RF45; plan §3 y §5.2). Recibe el estado de `useMenu()` por props y dibuja
// el que corresponda: marcadores de carga, error con "Reintentar", carta vacía, o las pestañas de categorías
// con una sección por categoría. No sabe nada de la mesa: sin mesa válida la carta se lee igual (solo
// lectura); lo que cambia se decide en la ficha y en el pedido.
//
// Aquí vive qué plato tiene la ficha abierta (RF14), si el resumen del pedido está abierto y la máquina de envío
// (`useSubmitOrder`): vive aquí y no en el resumen para que un envío en curso o sin resolver siga atendido aunque
// la hoja se cierre. T10 antepone la portada y convierte esta sección en el panel.
import { useEffect, useMemo, useState } from 'react'
import type { Dish, Order } from '../../domain/types'
import { useCart } from '../../state/CartContext'
import { useSubmitOrder } from '../../state/useSubmitOrder'
import type { UseMenu } from '../../state/useMenu'
import { CartBar } from '../cart/CartBar'
import { CartSheet } from '../cart/CartSheet'
import { DishSheet } from '../dish/DishSheet'
import { CategoryTabs } from './CategoryTabs'
import { MenuEmpty, MenuError, MenuLoading } from './MenuStates'
import { MenuSection } from './MenuSection'

interface MenuScreenProps {
  menu: UseMenu
  /** Un pedido quedó registrado en el restaurante (también si se recupera tras un corte): hay que ir a "Mis pedidos". */
  onSent: (order: Order) => void
}

export function MenuScreen({ menu, onSent }: MenuScreenProps) {
  const loaded = menu.status === 'ready' ? menu.menu : null
  const cart = useCart()
  const submit = useSubmitOrder({ menu: loaded, onSent, refreshMenu: menu.refresh })
  const [openDishId, setOpenDishId] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  // Sin platos no hay nada que revisar: si se quita el último, el resumen se cierra.
  useEffect(() => {
    if (cart.lines.length === 0) setCartOpen(false)
  }, [cart.lines.length])
  // Se busca en la carta vigente: si el plato desaparece con la ficha abierta, la ficha se cierra sola.
  const openDish = loaded?.dishes.find((dish) => dish.id === openDishId) ?? null
  const openVisual = loaded?.categories.find((category) => category.id === openDish?.categoryId)?.visual ?? 'main'
  const openSheet = (dish: Dish) => setOpenDishId(dish.id)

  // Los platos ya vienen ordenados por `order` (sortMenu): agrupar conserva ese orden.
  const sections = useMemo(
    () =>
      loaded?.categories.map((category) => ({
        category,
        dishes: loaded.dishes.filter((dish) => dish.categoryId === category.id),
      })) ?? [],
    [loaded],
  )

  return (
    // Ancla de la carta: "Ver la carta" de la portada (T10) se desplaza hasta aquí.
    <section id="carta" className="w-full scroll-mt-24 pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
      {menu.status === 'loading' && <MenuLoading />}
      {menu.status === 'error' && <MenuError offline={menu.offline} onRetry={menu.retry} />}
      {loaded && sections.length === 0 && <MenuEmpty />}
      {loaded && sections.length > 0 && (
        <>
          <CategoryTabs categories={sections.map((s) => s.category)} />
          {sections.map(({ category, dishes }) => (
            <MenuSection key={category.id} category={category} dishes={dishes} onOpenDish={openSheet} />
          ))}
        </>
      )}
      <CartBar menu={loaded} onOpen={() => setCartOpen(true)} />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} menu={loaded} submit={submit} onReopenDish={setOpenDishId} />
      {/* Después del resumen: desde "Elegir de nuevo" se abre por encima y al cerrarse vuelve a él */}
      <DishSheet dish={openDish} visual={openVisual} onClose={() => setOpenDishId(null)} />
    </section>
  )
}
