<template>
    <div>
        hello world {{ count }}
        <button @click="count++">Add</button>
    </div>
</template>

<script>
// 目前只支持这种写法
import { ref } from 'vue'
export default {
    setup() {
        const count = ref(0)
        return {
            count
        }
    }
}
</script>