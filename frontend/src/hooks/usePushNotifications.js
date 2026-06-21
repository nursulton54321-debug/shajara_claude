/**
 * 4.4 — Push Notifications hook
 * Ishlatish: const { supported, subscribed, subscribe, unsubscribe, sendBirthdays } = usePushNotifications()
 */
import { useEffect, useState, useCallback } from 'react'
import { getVapidKey, pushSubscribe, pushUnsubscribe, pushSendBirthdays } from '../api/persons'
import logger from '../utils/logger'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function usePushNotifications() {
  const [supported,   setSupported]   = useState(false)
  const [permission,  setPermission]  = useState('default')
  const [subscribed,  setSubscribed]  = useState(false)
  const [swReg,       setSwReg]       = useState(null)
  const [loading,     setLoading]     = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)
    setPermission(Notification.permission)

    // SW ro'yxatga olish
    navigator.serviceWorker.register('/sw.js').then(reg => {
      setSwReg(reg)
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub)
      })
    }).catch(err => logger.error('SW register xato:', err))
  }, [])

  const subscribe = useCallback(async () => {
    if (!swReg) return
    setLoading(true)
    try {
      // Ruxsat so'rash
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        throw new Error('Bildirishnoma ruxsati berilmadi')
      }
      // VAPID key olish
      const keyRes = await getVapidKey()
      const publicKey = keyRes.data.public_key
      // Subscribe
      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      // Backendga yuborish
      const subJson = sub.toJSON()
      await pushSubscribe({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      })
      setSubscribed(true)
      return true
    } catch (err) {
      logger.error('Push subscribe xato:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [swReg])

  const unsubscribe = useCallback(async () => {
    if (!swReg) return
    setLoading(true)
    try {
      const sub = await swReg.pushManager.getSubscription()
      if (sub) {
        await pushUnsubscribe(sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (err) {
      logger.error('Push unsubscribe xato:', err)
    } finally {
      setLoading(false)
    }
  }, [swReg])

  const sendBirthdays = useCallback(async (days = 7) => {
    return pushSendBirthdays(days)
  }, [])

  return { supported, permission, subscribed, loading, subscribe, unsubscribe, sendBirthdays }
}
