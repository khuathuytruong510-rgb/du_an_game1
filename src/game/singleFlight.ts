export class SingleFlight<T> {
  private pending: Promise<T | null> | null = null

  async run(
    shouldCreate: () => boolean,
    getExisting: () => T | null,
    create: () => Promise<T | null>
  ): Promise<T | null> {
    while (shouldCreate()) {
      if (this.pending) {
        const created = await this.pending
        if (!shouldCreate()) return null
        if (created && getExisting() === created) return created
        continue
      }

      const existing = getExisting()
      if (existing) return existing

      const creation = create()
      this.pending = creation
      try {
        const created = await creation
        return created && shouldCreate() && getExisting() === created
          ? created
          : null
      } finally {
        if (this.pending === creation) this.pending = null
      }
    }

    return null
  }
}
