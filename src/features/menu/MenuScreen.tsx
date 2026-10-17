// La carta (RF7-RF10, RF13, RF34, RF45; plan §3 y §5.2). Recibe el estado de `useMenu()` por props y dibuja
// el que corresponda: marcadores de carga, error con "Reintentar", carta vacía, o las pestañas de categorías
// con una sección por categoría. No sabe nada de la mesa: sin mesa válida la carta se lee igual (solo
// lectura); lo que cambia se decide en la ficha y en el pedido.
//
// Aquí vive qué plato tiene la ficha abierta (RF14), si el resumen del pedido está abierto y la máquina de envío
// (`useSubmitOrder`): vive aquí y no en el resumen para que un envío en curso o sin resolver siga atendido aunque
// la hoja se cierre. Antepone la portada (Hero, T10); la sección de la carta es el panel que se superpone al
// tercio inferior del anillo de la portada (plan §9.5).
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { Dish, Order } from '../../domain/types'
import { useCart } from '../../state/CartContext'
import { useSubmitOrder } from '../../state/useSubmitOrder'
import type { UseMenu } from '../../state/useMenu'
import { CartBar } from '../cart/CartBar'
import { CartSheet } from '../cart/CartSheet'
import { DishSheet } from '../dish/DishSheet'
import { Hero } from '../hero/Hero'
import { introProps } from '../../ui/motion'
import { useMediaQuery } from '../../ui/useMediaQuery'
import { CategoryTabs } from './CategoryTabs'
import { MenuEmpty, MenuError, MenuLoading } from './MenuStates'
import { MenuSection } from './MenuSection'
import { TableNotice } from './TableNotice'

interface MenuScreenProps {
  menu: UseMenu
  /** Un pedido quedó registrado en el restaurante (también si se recupera tras un corte): hay que ir a "Mis pedidos". */
  onSent: (order: Order) => void
  /** Reproducir la entrada animada de la portada y del panel (una vez por sesión, ver useIntroOnce). */
  intro?: boolean
}

export function MenuScreen({ menu, onSent, intro = false }: MenuScreenProps) {
  const compact = !useMediaQuery('(min-width: 768px)')
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
    <>
      <Hero menu={loaded} intro={intro} />
      {/* El panel: ancla de la carta ("Ver la carta" se desplaza hasta aquí). Sube sobre el tercio inferior del
          anillo (la carta del anillo mide 150 px en celular y 186 px desde 768 px) y deja asomar las pestañas. */}
      <motion.section
        id="carta"
        className="relative z-(--z-panel) -mx-4 -mt-[50px] scroll-mt-24 rounded-t-sheet border-t border-hairline bg-coal-900 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:-mx-6 md:-mt-[62px] md:px-6"
        {...introProps(intro, 'panel', compact)}
      >
        <TableNotice />
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
      </motion.section>
      {/* Fuera del panel: su entrada usa transform, que haría del panel el bloque contenedor de lo que es fixed */}
      <CartBar menu={loaded} onOpen={() => setCartOpen(true)} />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} menu={loaded} submit={submit} onReopenDish={setOpenDishId} />
      {/* Después del resumen: desde "Elegir de nuevo" se abre por encima y al cerrarse vuelve a él */}
      <DishSheet dish={openDish} visual={openVisual} onClose={() => setOpenDishId(null)} />
    </>
  )
}
