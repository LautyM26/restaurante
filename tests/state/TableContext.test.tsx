import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { parseTableParam } from '../../src/domain/table'
import { ServiceError } from '../../src/services/contracts'
import type { Services } from '../../src/services/contracts'
import { ServicesProvider } from '../../src/services/ServicesContext'
import { TableProvider, useTable } from '../../src/state/TableContext'
import { createFakeOrderService } from '../fixtures/fakeOrderService'

type GetTable = Services['menuService']['getTable']

/** Promesa que se resuelve o rechaza a mano, para ver el estado "verificando". */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(search: string, getTable: GetTable) {
  const getTableMock = vi.fn(getTable)
  const services: Services = {
    menuService: { getMenu: async () => ({ categories: [], dishes: [] }), getTable: getTableMock },
    orderService: createFakeOrderService(),
  }
  render(
    <ServicesProvider services={services}>
      <TableProvider parsed={parseTableParam(search)}>
        <Probe />
      </TableProvider>
    </ServicesProvider>,
  )
  return getTableMock
}

function Probe() {
  const table = useTable()
  return (
    <>
      <p>Estado: {table.status}</p>
      <p>Mesa: {'tableId' in table ? table.tableId : 'ninguna'}</p>
      <button onClick={table.retry}>reintentar</button>
      <button onClick={table.markInvalid}>invalidar</button>
    </>
  )
}

const networkError = () => new ServiceError('NETWORK', 'sin red')

describe('TableContext: del QR a la mesa (plan §5.1)', () => {
  it('sin ?mesa queda en missing y no consulta al servicio', () => {
    const getTable = setup('', async (id) => ({ id }))
    expect(screen.getByText('Estado: missing')).toBeInTheDocument()
    expect(screen.getByText('Mesa: ninguna')).toBeInTheDocument()
    expect(getTable).not.toHaveBeenCalled()
  })

  it('con ?mesa= vacío también es missing', () => {
    setup('?mesa=', async (id) => ({ id }))
    expect(screen.getByText('Estado: missing')).toBeInTheDocument()
  })

  it.each(['?mesa=abc', '?mesa=0', '?mesa=-3', '?mesa=12.5', '?mesa=1000'])('%s es invalid y no consulta al servicio', (search) => {
    const getTable = setup(search, async (id) => ({ id }))
    expect(screen.getByText('Estado: invalid')).toBeInTheDocument()
    expect(getTable).not.toHaveBeenCalled()
  })

  it('con una mesa bien escrita pasa por checking y termina en valid', async () => {
    const check = deferred<{ id: number } | null>()
    const getTable = setup('?mesa=12', () => check.promise)

    expect(screen.getByText('Estado: checking')).toBeInTheDocument()
    expect(screen.getByText('Mesa: 12')).toBeInTheDocument()
    expect(getTable).toHaveBeenCalledWith(12)

    await act(async () => check.resolve({ id: 12 }))
    expect(screen.getByText('Estado: valid')).toBeInTheDocument()
    expect(screen.getByText('Mesa: 12')).toBeInTheDocument()
  })

  it('"012" equivale a la mesa 12', async () => {
    const getTable = setup('?mesa=012', async (id) => ({ id }))
    expect(getTable).toHaveBeenCalledWith(12)
    expect(await screen.findByText('Mesa: 12')).toBeInTheDocument()
  })

  it('si mesa se repite vale la primera', async () => {
    const getTable = setup('?mesa=5&mesa=9', async (id) => ({ id }))
    expect(await screen.findByText('Estado: valid')).toBeInTheDocument()
    expect(getTable).toHaveBeenCalledTimes(1)
    expect(getTable).toHaveBeenCalledWith(5)
  })

  it('una mesa que el restaurante no tiene es invalid', async () => {
    setup('?mesa=50', async () => null)
    expect(await screen.findByText('Estado: invalid')).toBeInTheDocument()
  })

  it('si la verificación falla queda unverified, no invalid', async () => {
    setup('?mesa=12', async () => {
      throw networkError()
    })
    expect(await screen.findByText('Estado: unverified')).toBeInTheDocument()
    expect(screen.getByText('Mesa: 12')).toBeInTheDocument()
  })

  it('retry() vuelve a verificar: checking y luego valid', async () => {
    const second = deferred<{ id: number } | null>()
    const getTable = setup('?mesa=12', vi.fn<GetTable>().mockRejectedValueOnce(networkError()).mockReturnValueOnce(second.promise))
    await screen.findByText('Estado: unverified')

    await userEvent.click(screen.getByRole('button', { name: 'reintentar' }))
    expect(screen.getByText('Estado: checking')).toBeInTheDocument()

    await act(async () => second.resolve({ id: 12 }))
    expect(screen.getByText('Estado: valid')).toBeInTheDocument()
    expect(getTable).toHaveBeenCalledTimes(2)
  })

  it('retry() puede volver a fallar y se sigue pudiendo reintentar', async () => {
    const getTable = setup('?mesa=12', vi.fn<GetTable>().mockRejectedValue(networkError()))
    await screen.findByText('Estado: unverified')

    await userEvent.click(screen.getByRole('button', { name: 'reintentar' }))
    await waitFor(() => expect(getTable).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Estado: unverified')).toBeInTheDocument()
  })

  it('retry() no hace nada si la mesa ya está verificada', async () => {
    const getTable = setup('?mesa=12', async (id) => ({ id }))
    await screen.findByText('Estado: valid')

    await userEvent.click(screen.getByRole('button', { name: 'reintentar' }))
    expect(getTable).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Estado: valid')).toBeInTheDocument()
  })

  it('al volver la conexión reintenta solo cuando la mesa está sin verificar', async () => {
    const getTable = setup('?mesa=12', vi.fn<GetTable>().mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ id: 12 }))
    await screen.findByText('Estado: unverified')

    act(() => void window.dispatchEvent(new Event('online')))
    expect(await screen.findByText('Estado: valid')).toBeInTheDocument()
    expect(getTable).toHaveBeenCalledTimes(2)
  })

  it('el evento online no vuelve a consultar una mesa que ya es valid', async () => {
    const getTable = setup('?mesa=12', async (id) => ({ id }))
    await screen.findByText('Estado: valid')

    act(() => void window.dispatchEvent(new Event('online')))
    expect(getTable).toHaveBeenCalledTimes(1)
  })

  it('markInvalid() marca la mesa como invalid (el envío recibió INVALID_TABLE)', async () => {
    setup('?mesa=12', async (id) => ({ id }))
    await screen.findByText('Estado: valid')

    await userEvent.click(screen.getByRole('button', { name: 'invalidar' }))
    expect(screen.getByText('Estado: invalid')).toBeInTheDocument()
  })

  it('useTable fuera del provider da un error claro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/TableProvider/)
    spy.mockRestore()
  })
})
