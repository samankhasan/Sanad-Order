import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// default view: Iraq
const IRAQ: L.LatLngTuple = [33.3, 44.4]

const pin = L.divIcon({
  className: '',
  html: '<div style="width:34px;height:34px;transform:translate(-50%,-100%);position:relative"><svg viewBox="0 0 24 24" width="34" height="34"><path fill="#e10e19" stroke="#fff" stroke-width="1.5" d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.4 7.3 11.7.4.3 1 .3 1.4 0C13 21.4 20 15.4 20 10c0-4.4-3.6-8-8-8Z"/><circle cx="12" cy="10" r="3.2" fill="#fff"/></svg></div>',
  iconSize: [0, 0]
})

/** OpenStreetMap with one pin. Editable: tap the map or drag the pin to move it. */
export default function MapPicker({ value, onChange, readOnly, className }: {
  value: { lat: number; lng: number } | null
  onChange?: (v: { lat: number; lng: number }) => void
  readOnly?: boolean
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    if (!box.current || map.current) return
    const m = L.map(box.current, { zoomControl: !readOnly, attributionControl: true, dragging: !readOnly || !L.Browser.mobile, scrollWheelZoom: !readOnly, tap: false } as L.MapOptions)
      .setView(value ? [value.lat, value.lng] : IRAQ, value ? 16 : 6)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
    if (!readOnly) m.on('click', (e: L.LeafletMouseEvent) => cb.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
    map.current = m
    // the container may have been hidden while opening (sheet animation)
    setTimeout(() => m.invalidateSize(), 250)
    return () => { m.remove(); map.current = null; marker.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!value) { marker.current?.remove(); marker.current = null; return }
    const ll: L.LatLngTuple = [value.lat, value.lng]
    if (!marker.current) {
      marker.current = L.marker(ll, { icon: pin, draggable: !readOnly, keyboard: false }).addTo(m)
      marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); cb.current?.({ lat: p.lat, lng: p.lng }) })
      m.setView(ll, Math.max(m.getZoom(), 16))
    } else {
      marker.current.setLatLng(ll)
      if (!m.getBounds().pad(-0.2).contains(ll)) m.panTo(ll)
    }
  }, [value, readOnly])

  return <div ref={box} className={className} style={{ zIndex: 0 }} />
}
