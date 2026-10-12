// La carta (RF7-RF10, RF13, RF34, RF45; plan §3 y §5.2). Recibe el estado de `useMenu()` por props y dibuja
// el que corresponda: marcadores de carga, error con "Reintentar", carta vacía, o las pestañas de categorías
// con una sección por categoría. No sabe nada de la mesa: sin mesa válida la carta se lee igual (solo
// lectura); lo que cambia se decide en la ficha y en el pedido.
//
// Aquí vive qué plato tiene la ficha abierta (RF14). T8 monta la barra y el resumen del pedido; T10 antepone
// la portada y convierte esta sección en el panel.
import { useMemo, useState } from 'react'
import type { Dish } from '../../domain/types'
import type { UseMenu } from '../../state/useMenu'
import { DishSheet } from '../dish/DishSheet'
import { CategoryTabs } from './CategoryTabs'
import { MenuEmpty, MenuError, MenuLoading } from './MenuStates'
import { MenuSection } from './MenuSection'

interface MenuScreenProps {
  menu: UseMenu
}

export function MenuScreen({ menu }: MenuScreenProps) {
  const loaded = menu.status === 'ready' ? menu.menu : null
  const [openDishId, setOpenDishId] = useState<string | null>(null)
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
    <section id="carta" className="w-full scroll-mt-24">
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
      <DishSheet dish={openDish} visual={openVisual} onClose={() => setOpenDishId(null)} />
    </section>
  )
}
