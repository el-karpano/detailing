import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** При переходе между страницами — всегда вверх. */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}
