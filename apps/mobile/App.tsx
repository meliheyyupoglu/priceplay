import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { createLiveCheapsharkApi, type Game } from '../../packages/shared/src'

export default function App() {
  const api = useMemo(() => createLiveCheapsharkApi(), [])
  const [popular, setPopular] = useState<Game[]>([])
  const [discounted, setDiscounted] = useState<Game[]>([])
  const [free100, setFree100] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [p, d, f] = await Promise.all([
          api.fetchPopularGames(1),
          api.fetchDiscountedGames(1),
          api.fetchHundredPercentFreeDeals(24, 3),
        ])
        if (cancelled) return
        setPopular(p.slice(0, 10))
        setDiscounted(d.slice(0, 10))
        setFree100(f.slice(0, 10))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown mobile data error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api])

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>PricePlay Mobile</Text>
        <Text style={styles.subtitle}>Canli CheapShark API</Text>
        {loading && <Text style={styles.muted}>Loading...</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && (
          <>
            <Section title="Popular (top 10)" games={popular} />
            <Section title="Discounted (top 10)" games={discounted} />
            <Section title="Free deals (top 10)" games={free100} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, games }: { title: string; games: Game[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {games.map((g) => (
        <View key={g.gameId || g.title} style={styles.row}>
          <Text style={styles.gameTitle} numberOfLines={1}>
            {g.title}
          </Text>
          <Text style={styles.price}>${g.cheapest ?? '-'}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d1117' },
  container: { padding: 16, gap: 14 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#7d8590' },
  muted: { color: '#8b949e' },
  error: { color: '#ff7b72' },
  section: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  sectionTitle: { color: '#c9d1d9', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  gameTitle: { flex: 1, color: '#c9d1d9' },
  price: { color: '#58a6ff', fontWeight: '700' },
})
