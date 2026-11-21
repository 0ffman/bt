<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from './supabase'
import Auth from './components/Auth.vue'
import BossTracker from './components/BossTracker.vue'

const session = ref(null)
let authListener = null

onMounted(() => {
  supabase.auth.getSession().then(({ data }) => {
    session.value = data.session
  })

  const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
  })
  authListener = data.subscription
})

onUnmounted(() => {
  authListener?.unsubscribe()
})
</script>

<template>
  <div>
    <Auth v-if="!session" />
    <BossTracker v-else />
  </div>
</template>