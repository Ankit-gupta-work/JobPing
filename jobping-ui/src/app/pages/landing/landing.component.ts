import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-bg-base">
      <!-- glow orbs -->
      <div class="glow-orb w-[420px] h-[420px] -top-20 -left-10"></div>
      <div class="glow-orb w-[360px] h-[360px] top-40 right-0 opacity-30"></div>

      <!-- top bar -->
      <header class="relative z-10 max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="grid place-items-center w-8 h-8 rounded-md bg-accent-muted border border-accent-border">
            <span class="text-accent-light font-mono text-sm">JP</span>
          </span>
          <span class="text-gradient font-bold text-lg">JobPing</span>
        </div>
        <div class="flex items-center gap-2">
          <a routerLink="/auth/login" class="px-4 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary transition-colors">Sign in</a>
          <a routerLink="/auth/register" class="px-4 py-2 rounded-md text-sm bg-accent text-white hover:bg-accent-hover transition-colors">Get started</a>
        </div>
      </header>

      <!-- hero -->
      <main class="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center pt-16 lg:pt-24">
        <div class="fade-up">
          <p class="font-mono text-sm text-accent-light mb-4">// developer job alerts, automated</p>
          <h1 class="text-4xl sm:text-6xl font-extrabold leading-tight text-text-primary">
            Get pinged for jobs that <span class="text-gradient">actually match</span> your skills.
          </h1>
          <p class="mt-6 text-lg text-text-secondary max-w-xl">
            JobPing scans fresh remote roles every 2 hours, scores them against your skill profile,
            and emails you only the strong matches.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/auth/register" class="px-6 py-3 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors shadow-glow">
              Create your profile
            </a>
            <a routerLink="/auth/login" class="px-6 py-3 rounded-md border border-border-default text-text-primary hover:border-border-strong transition-colors">
              I already have an account
            </a>
          </div>
        </div>

        <!-- floating preview cards -->
        <div class="relative h-[360px] hidden lg:block">
          <div class="float absolute top-0 left-6 w-72 p-5 rounded-lg bg-bg-surface border border-border-default shadow-glow">
            <div class="flex items-center justify-between">
              <span class="text-text-primary font-semibold">Senior .NET Developer</span>
              <span class="text-accent-light font-mono text-sm">92%</span>
            </div>
            <p class="text-text-muted text-sm mt-1">Techwave • Remote</p>
            <div class="match-bar mt-3"><div class="match-bar-fill" style="width:92%"></div></div>
          </div>
          <div class="float-delay absolute top-40 right-2 w-72 p-5 rounded-lg bg-bg-surface border border-border-default">
            <div class="flex items-center justify-between">
              <span class="text-text-primary font-semibold">Angular Engineer</span>
              <span class="text-accent-light font-mono text-sm">87%</span>
            </div>
            <p class="text-text-muted text-sm mt-1">Nimbus • Remote</p>
            <div class="match-bar mt-3"><div class="match-bar-fill" style="width:87%"></div></div>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class LandingComponent {}
