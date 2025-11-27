<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <div class="card max-w-lg text-center">
      <div class="text-6xl mb-4">??</div>
      <h1 class="text-3xl font-bold text-slate-50 mb-2">Page Not Found</h1>
      <p class="text-slate-400 mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div class="flex gap-3 justify-center">
        <button class="btn" @click="router.back()">
          ? Go Back
        </button>
        <button class="btn btn-primary" @click="router.push({ name: 'home' })">
          ?? Home
        </button>
      </div>
    </div>
  </div>
</template>
